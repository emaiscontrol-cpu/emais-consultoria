"""Seed inicial do módulo Plano Referencial: 5 segmentos + 1 plano singleton."""
from sqlalchemy.orm import Session
from models import Segmento, PlanoReferencial

_SEGMENTOS = ["Varejo Alimentar", "Drogarias", "Cosméticos", "Auto Peças", "Outros"]


def seed_ref_plano(db: Session) -> None:
    if db.query(Segmento).count() == 0:
        for nome in _SEGMENTOS:
            db.add(Segmento(nome=nome))
        db.commit()

    if db.query(PlanoReferencial).count() == 0:
        db.add(PlanoReferencial(nome="Plano Referencial E Mais"))
        db.commit()
