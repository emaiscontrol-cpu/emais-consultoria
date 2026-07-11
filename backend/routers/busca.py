from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from security import get_usuario_atual
import models

router = APIRouter()


@router.get("/")
def busca_global(
    q: str = Query(min_length=2),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    termo = f"%{q}%"
    restrito = usuario.perfil in ("analista", "ger_projeto", "ti")

    q_proj = db.query(models.Projeto).filter(
        models.Projeto.ativo == True,
        models.Projeto.nome.ilike(termo),
    )
    if restrito:
        q_proj = q_proj.filter(models.Projeto.cliente_id == usuario.cliente_id)
    projetos = [
        {
            "tipo": "projeto",
            "id": p.id,
            "titulo": p.nome,
            "subtitulo": p.cliente.razao_social if p.cliente else "",
            "url": f"/projetos/{p.id}",
        }
        for p in q_proj.limit(5).all()
    ]

    q_tar = (
        db.query(models.Tarefa)
        .join(models.Fase)
        .join(models.Projeto)
        .filter(
            models.Tarefa.ativo == True,
            models.Projeto.ativo == True,
            models.Tarefa.nome.ilike(termo),
        )
    )
    if restrito:
        q_tar = q_tar.filter(models.Projeto.cliente_id == usuario.cliente_id)
    tarefas = [
        {
            "tipo": "tarefa",
            "id": t.id,
            "titulo": t.nome,
            "subtitulo": f"{t.fase.projeto.nome} › {t.fase.nome}" if t.fase and t.fase.projeto else "",
            "url": f"/projetos/{t.fase.projeto_id}" if t.fase else "",
        }
        for t in q_tar.limit(5).all()
    ]

    clientes = []
    if usuario.perfil in ("admin", "consultor"):
        q_cli = db.query(models.Cliente).filter(
            models.Cliente.ativo == True,
            models.Cliente.razao_social.ilike(termo),
        )
        clientes = [
            {
                "tipo": "cliente",
                "id": c.id,
                "titulo": c.razao_social,
                "subtitulo": c.cnpj or "",
                "url": "/clientes",
            }
            for c in q_cli.limit(5).all()
        ]

    q_com = (
        db.query(models.Comentario)
        .join(models.Tarefa)
        .join(models.Fase)
        .join(models.Projeto)
        .filter(
            models.Projeto.ativo == True,
            models.Comentario.texto.ilike(termo),
        )
    )
    if restrito:
        q_com = q_com.filter(models.Projeto.cliente_id == usuario.cliente_id)
    comentarios = [
        {
            "tipo": "comentario",
            "id": c.id,
            "titulo": (c.texto[:80] + "...") if len(c.texto) > 80 else c.texto,
            "subtitulo": f"em {c.tarefa.nome}" if c.tarefa else "",
            "url": f"/projetos/{c.tarefa.fase.projeto_id}" if c.tarefa and c.tarefa.fase else "",
        }
        for c in q_com.limit(5).all()
    ]

    return {
        "projetos": projetos,
        "tarefas": tarefas,
        "clientes": clientes,
        "comentarios": comentarios,
    }
