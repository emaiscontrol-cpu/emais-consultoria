"""Serviço de sugestão automática de De-Para por similaridade textual + aprendizado cross-cliente."""
from datetime import date
from sqlalchemy.orm import Session
import models

try:
    from rapidfuzz import fuzz as _fuzz
    def _similarity(a: str, b: str) -> float:
        return _fuzz.WRatio(a, b) / 100.0
except ImportError:
    def _similarity(a: str, b: str) -> float:
        # fallback simples sem rapidfuzz
        a_set, b_set = set(a.split()), set(b.split())
        if not a_set or not b_set:
            return 0.0
        return len(a_set & b_set) / max(len(a_set), len(b_set))

_THRESHOLD_ALTO = 0.80


def sugerir(db: Session, conta_cliente: models.ContaClienteRef, top: int = 5) -> list[dict]:
    """
    Retorna lista de sugestões ordenadas por confiança decrescente.
    Cada item: {conta_referencial_id, confianca, origem_vinculo, codigo, descricao, usado_em_n_clientes}
    """
    contas_ref = (
        db.query(models.ContaReferencial)
        .filter(models.ContaReferencial.tipo == "analitica",
                models.ContaReferencial.ativo == True)
        .all()
    )
    if not contas_ref:
        return []

    desc_orig = conta_cliente.descricao_origem.strip().lower()

    # Aprendizado cross-cliente: De-Para confirmados de outros clientes com descrição similar
    outros_confirmados = (
        db.query(models.DeParaRef, models.ContaClienteRef)
        .join(models.ContaClienteRef,
              models.DeParaRef.conta_cliente_id == models.ContaClienteRef.id)
        .filter(
            models.DeParaRef.status == "confirmado",
            models.ContaClienteRef.cliente_id != conta_cliente.cliente_id,
        )
        .all()
    )

    boost: dict[int, float] = {}        # ref_id → max cross-client score
    uso_count: dict[int, int] = {}      # ref_id → quantos clientes usam

    for depara, cc in outros_confirmados:
        sim = _similarity(desc_orig, cc.descricao_origem.strip().lower())
        if sim >= 0.7:
            rid = depara.conta_referencial_id
            if sim > boost.get(rid, 0.0):
                boost[rid] = sim
            uso_count[rid] = uso_count.get(rid, 0) + 1

    resultados = []
    for conta_ref in contas_ref:
        sim_texto = _similarity(desc_orig, conta_ref.descricao.strip().lower())

        rid = conta_ref.id
        if rid in boost:
            confianca = min(1.0, sim_texto * 0.4 + boost[rid] * 0.6)
            origem = "aprendido_de_outro_cliente"
        else:
            confianca = sim_texto
            origem = "sugestao_automatica"

        resultados.append({
            "conta_referencial_id": rid,
            "confianca": round(confianca, 4),
            "origem_vinculo": origem,
            "codigo": conta_ref.codigo,
            "descricao": conta_ref.descricao,
            "usado_em_n_clientes": uso_count.get(rid, 0),
        })

    resultados.sort(key=lambda x: x["confianca"], reverse=True)
    return resultados[:top]


def aplicar_automatico(
    db: Session,
    conta_cliente: models.ContaClienteRef,
    ano: int,
    mes: int,
) -> models.DeParaRef | None:
    """
    Cria o De-Para com melhor sugestão automaticamente.
    Alta confiança → confirmado; baixa confiança → pendente_revisao (nunca bloqueia).
    """
    sugestoes = sugerir(db, conta_cliente)
    if not sugestoes:
        return None

    melhor = sugestoes[0]
    status = "confirmado" if melhor["confianca"] >= _THRESHOLD_ALTO else "pendente_revisao"

    depara = models.DeParaRef(
        conta_cliente_id=conta_cliente.id,
        conta_referencial_id=melhor["conta_referencial_id"],
        percentual=100.0,
        status=status,
        confianca=melhor["confianca"],
        origem_vinculo=melhor["origem_vinculo"],
        vigente_a_partir=date(ano, mes, 1),
    )
    db.add(depara)
    return depara
