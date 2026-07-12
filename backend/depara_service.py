"""Serviço de sugestão automática de De-Para por similaridade textual + aprendizado cross-cliente."""
import unicodedata
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


def normalizar_texto(s: str) -> str:
    """Normaliza texto para comparação: minúsculas, sem acento, sem espaços nas pontas.

    Camada 1 do Preparo DE-PARA (Fase B) exige que o match ignore maiúsc/minúsc e
    acentuação — ex: 'Água' == 'agua', 'MERCADORIAS' == 'mercadorias'.
    """
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s


_THRESHOLD_ALTO = 0.80   # confiança mínima para auto-vínculo direto (Camada 1)
_THRESHOLD_MEDIO = 0.55  # confiança mínima para considerar candidato em zona ambígua
_GAP_DESAMBIGUACAO = 0.12  # diferença mínima entre 1º e 2º candidato para não ser ambíguo


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

    desc_orig = normalizar_texto(conta_cliente.descricao_origem)

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
        sim = _similarity(desc_orig, normalizar_texto(cc.descricao_origem))
        if sim >= 0.7:
            rid = depara.conta_referencial_id
            if sim > boost.get(rid, 0.0):
                boost[rid] = sim
            uso_count[rid] = uso_count.get(rid, 0) + 1

    resultados = []
    for conta_ref in contas_ref:
        sim_texto = _similarity(desc_orig, normalizar_texto(conta_ref.descricao))

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


def _resolver_por_grupo(db: Session, conta_cliente: models.ContaClienteRef, candidatos: list[dict]) -> dict | None:
    """
    Camada 2 — desambiguação por hierarquia (pai_id): entre candidatos empatados,
    prefere aquele cujo grupo/pai (ContaReferencial.pai) compartilha algum termo com
    a descrição da conta do cliente. Só resolve se exatamente 1 candidato bater;
    caso contrário (0 ou 2+), permanece ambíguo.
    """
    tokens_cliente = set(normalizar_texto(conta_cliente.descricao_origem).split())
    resolvidos = []
    for cand in candidatos:
        conta_ref = db.get(models.ContaReferencial, cand["conta_referencial_id"])
        pai = conta_ref.pai if conta_ref else None
        if pai:
            tokens_pai = set(normalizar_texto(pai.descricao).split())
            if tokens_pai & tokens_cliente:
                resolvidos.append(cand)
    return resolvidos[0] if len(resolvidos) == 1 else None


def classificar(db: Session, conta_cliente: models.ContaClienteRef, top: int = 5) -> dict:
    """
    Classifica uma conta do cliente nas 3 camadas do Preparo DE-PARA (Fase B):
    - 'auto_vinculada': match forte e sem ambiguidade (ou desambiguado pela Camada 2)
    - 'ambigua': 2+ candidatos próximos, sem desambiguação possível pelo grupo/pai
    - 'sem_match': nenhum candidato com confiança suficiente

    Retorna {situacao, candidatos, resolvido_por (opcional)}. Não grava nada no banco
    — é só a classificação; a gravação (DeParaRef) acontece na tratativa do usuário.
    """
    sugestoes = sugerir(db, conta_cliente, top=max(top, 5))
    if not sugestoes:
        return {"situacao": "sem_match", "candidatos": []}

    melhor = sugestoes[0]
    segunda = sugestoes[1] if len(sugestoes) > 1 else None
    gap = (melhor["confianca"] - segunda["confianca"]) if segunda else 1.0

    if melhor["confianca"] >= _THRESHOLD_ALTO and gap >= _GAP_DESAMBIGUACAO:
        return {"situacao": "auto_vinculada", "candidatos": [melhor]}

    proximos = [
        s for s in sugestoes
        if s["confianca"] >= _THRESHOLD_MEDIO and (melhor["confianca"] - s["confianca"]) < _GAP_DESAMBIGUACAO
    ]
    if len(proximos) >= 2:
        resolvido = _resolver_por_grupo(db, conta_cliente, proximos)
        if resolvido:
            return {"situacao": "auto_vinculada", "candidatos": [resolvido], "resolvido_por": "grupo"}
        return {"situacao": "ambigua", "candidatos": proximos}

    if melhor["confianca"] >= _THRESHOLD_MEDIO:
        return {"situacao": "auto_vinculada", "candidatos": [melhor]}

    return {"situacao": "sem_match", "candidatos": sugestoes[:3]}
