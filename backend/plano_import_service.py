"""
Importação de estrutura de Plano de Contas a partir de lista já parseada.

Modos:
  NOVO      → exige plano vazio; importa tudo
  ATUALIZAR → adiciona novas contas, atualiza descrição das existentes
  MESCLAR   → mantém modulo/movimento/agrupamento das existentes; só atualiza descrição
"""

from sqlalchemy.orm import Session
from models import PlanoItem, ClientePlano


def importar_plano(
    contas: list[dict],
    cliente_id: int,
    modo: str,
    db: Session,
) -> dict:
    """
    Importa contas para o plano vinculado ao cliente.
    Retorna relatório com criadas, atualizadas, ignoradas, erros.
    """
    vinculo = db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).first()
    if not vinculo:
        raise ValueError("Cliente sem plano de contas vinculado")
    plano_id = vinculo.plano_id

    items_existentes = (
        db.query(PlanoItem).filter(PlanoItem.plano_id == plano_id).all()
    )

    if modo == "NOVO" and len(items_existentes) > 0:
        raise ValueError(
            f"Modo NOVO requer plano vazio, mas já existem "
            f"{len(items_existentes)} itens. Use ATUALIZAR ou MESCLAR."
        )

    # Index por código de conta (normalizado)
    idx: dict[str, PlanoItem] = {
        (it.conta or "").strip(): it for it in items_existentes if it.conta
    }

    criadas = 0
    atualizadas = 0
    ignoradas = 0
    erros: list[dict] = []
    base_ordem = len(items_existentes)

    for i, c in enumerate(contas):
        codigo = (c.get("conta") or "").strip()
        desc = (c.get("descricao") or codigo).strip()
        tipo = c.get("tipo", "AN")
        nivel = c.get("nivel", 3)

        if not codigo:
            ignoradas += 1
            continue

        existente = idx.get(codigo)

        try:
            if modo == "NOVO":
                db.add(PlanoItem(
                    plano_id=plano_id,
                    conta=codigo,
                    descricao=desc,
                    tipo=tipo,
                    nivel=nivel,
                    agrupamento=None,
                    modulo=None,
                    movimento=None,
                    ordem=i,
                ))
                criadas += 1

            elif modo == "ATUALIZAR":
                if existente:
                    existente.descricao = desc
                    atualizadas += 1
                else:
                    db.add(PlanoItem(
                        plano_id=plano_id,
                        conta=codigo,
                        descricao=desc,
                        tipo=tipo,
                        nivel=nivel,
                        agrupamento=None,
                        modulo=None,
                        movimento=None,
                        ordem=base_ordem + i,
                    ))
                    criadas += 1

            elif modo == "MESCLAR":
                if existente:
                    # Mantém agrupamento/modulo/movimento; só atualiza descricao e nivel/tipo
                    existente.descricao = desc
                    existente.nivel = nivel
                    existente.tipo = tipo
                    atualizadas += 1
                else:
                    db.add(PlanoItem(
                        plano_id=plano_id,
                        conta=codigo,
                        descricao=desc,
                        tipo=tipo,
                        nivel=nivel,
                        agrupamento=None,
                        modulo=None,
                        movimento=None,
                        ordem=base_ordem + i,
                    ))
                    criadas += 1

        except Exception as e:
            erros.append({"codigo": codigo, "erro": str(e)})
            ignoradas += 1

    db.commit()
    return {
        "criadas": criadas,
        "atualizadas": atualizadas,
        "ignoradas": ignoradas,
        "erros": erros,
    }
