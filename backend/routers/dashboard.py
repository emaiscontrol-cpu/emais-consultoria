from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from database import get_db
from auth import get_usuario_atual
import models, schemas

router = APIRouter()

@router.get("/resumo", response_model=schemas.DashboardResumo)
def resumo(db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    q_proj = db.query(models.Projeto)
    q_tar  = db.query(models.Tarefa)

    if usuario.perfil == "cliente":
        q_proj = q_proj.filter(models.Projeto.cliente_id == usuario.cliente_id)
        ids = [p.id for p in q_proj.all()]
        fase_ids = [f.id for p_id in ids
                    for f in db.query(models.Fase).filter(models.Fase.projeto_id == p_id).all()]
        q_tar = q_tar.filter(models.Tarefa.fase_id.in_(fase_ids))

    agora = datetime.now(timezone.utc)
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    return {
        "total_projetos":          q_proj.count(),
        "projetos_ativos":         q_proj.filter(models.Projeto.status == "em_andamento").count(),
        "projetos_atrasados":      q_proj.filter(models.Projeto.status == "atrasado").count(),
        "tarefas_em_andamento":    q_tar.filter(models.Tarefa.status == "em_andamento").count(),
        "tarefas_concluidas_mes":  q_tar.filter(
            models.Tarefa.status == "concluida",
            models.Tarefa.data_conclusao >= inicio_mes
        ).count(),
        "tarefas_atrasadas": q_tar.filter(
            models.Tarefa.status != "concluida",
            models.Tarefa.data_prazo < agora
        ).count(),
    }

@router.get("/projetos-resumo")
def projetos_resumo(db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    q = db.query(models.Projeto)
    if usuario.perfil == "cliente":
        q = q.filter(models.Projeto.cliente_id == usuario.cliente_id)
    projetos = q.order_by(models.Projeto.criado_em.desc()).limit(10).all()
    return [
        {
            "id": p.id,
            "nome": p.nome,
            "cliente": p.cliente.razao_social if p.cliente else "",
            "status": p.status,
            "progresso": p.progresso,
            "total_fases": len(p.fases),
            "fases_concluidas": sum(1 for f in p.fases if f.status == "concluida"),
        }
        for p in projetos
    ]
