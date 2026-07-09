from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from database import get_db
from security import get_usuario_atual, verificar_tenant
import models, schemas

router = APIRouter()

@router.get("/resumo", response_model=schemas.DashboardResumo)
def resumo(db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    q_proj = db.query(models.Projeto).filter(models.Projeto.ativo == True)
    q_tar  = db.query(models.Tarefa).filter(models.Tarefa.ativo == True)

    if usuario.perfil == "analista":
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

@router.get("/cliente/{cliente_id}")
def dashboard_cliente(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    # perfis restritos só acessam seu próprio cliente
    verificar_tenant(usuario, cliente_id)

    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")

    projetos = db.query(models.Projeto).filter(
        models.Projeto.cliente_id == cliente_id,
        models.Projeto.ativo == True,
    ).all()
    agora = datetime.now(timezone.utc)

    projetos_data = []
    total_tarefas = total_concluidas = total_andamento = total_pendentes = total_atrasadas = 0

    for p in projetos:
        fases_data = []
        p_tarefas = p_conc = p_and = p_pend = p_atras = 0

        for f in sorted(p.fases, key=lambda x: x.ordem):
            tarefas = [t for t in f.tarefas if t.ativo]
            conc  = sum(1 for t in tarefas if t.status == "concluida")
            and_  = sum(1 for t in tarefas if t.status == "em_andamento")
            pend  = sum(1 for t in tarefas if t.status == "pendente")
            atras = sum(1 for t in tarefas if t.status != "concluida" and t.data_prazo and t.data_prazo.replace(tzinfo=timezone.utc) < agora)

            fases_data.append({
                "id": f.id, "nome": f.nome, "ordem": f.ordem,
                "status": f.status, "progresso": round(f.progresso, 1),
                "total": len(tarefas), "concluidas": conc,
                "andamento": and_, "pendentes": pend, "atrasadas": atras,
            })
            p_tarefas += len(tarefas); p_conc += conc; p_and += and_
            p_pend += pend; p_atras += atras

        projetos_data.append({
            "id": p.id, "nome": p.nome, "status": p.status,
            "progresso": round(p.progresso, 1),
            "data_inicio": p.data_inicio.isoformat() if p.data_inicio else None,
            "data_fim_prev": p.data_fim_prev.isoformat() if p.data_fim_prev else None,
            "fases": fases_data,
            "total_tarefas": p_tarefas, "concluidas": p_conc,
            "andamento": p_and, "pendentes": p_pend, "atrasadas": p_atras,
        })
        total_tarefas += p_tarefas; total_concluidas += p_conc
        total_andamento += p_and; total_pendentes += p_pend; total_atrasadas += p_atras

    return {
        "cliente": {"id": cliente.id, "razao_social": cliente.razao_social},
        "projetos": projetos_data,
        "resumo": {
            "total_projetos": len(projetos),
            "total_tarefas": total_tarefas,
            "concluidas": total_concluidas,
            "andamento": total_andamento,
            "pendentes": total_pendentes,
            "atrasadas": total_atrasadas,
            "progresso_geral": round(
                sum(p["progresso"] for p in projetos_data) / len(projetos_data), 1
            ) if projetos_data else 0,
        },
    }


@router.get("/executivo")
def executivo(db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    """Visão executiva de todos os clientes para admin/consultor (UX-2)."""
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Acesso restrito")
    agora = datetime.now(timezone.utc)
    clientes = db.query(models.Cliente).filter(models.Cliente.ativo == True).all()
    resultado = []
    for c in clientes:
        projetos = db.query(models.Projeto).filter(
            models.Projeto.cliente_id == c.id,
            models.Projeto.ativo == True,
        ).all()
        if not projetos:
            continue
        ativos = sum(1 for p in projetos if p.status not in ("concluido", "pausado"))
        atrasadas = 0
        for p in projetos:
            for f in p.fases:
                if not getattr(f, 'ativo', True):
                    continue
                for t in f.tarefas:
                    if not getattr(t, 'ativo', True):
                        continue
                    if t.status.value != "concluida" and t.data_prazo:
                        prazo = t.data_prazo
                        if prazo.tzinfo is None:
                            prazo = prazo.replace(tzinfo=timezone.utc)
                        if prazo < agora:
                            atrasadas += 1
        progresso_medio = round(sum(p.progresso for p in projetos) / len(projetos), 1)
        resultado.append({
            "id": c.id,
            "razao_social": c.razao_social,
            "projetos_ativos": ativos,
            "total_projetos": len(projetos),
            "progresso_medio": progresso_medio,
            "tarefas_atrasadas": atrasadas,
        })
    resultado.sort(key=lambda x: -x["tarefas_atrasadas"])
    return resultado


@router.get("/projetos-resumo")
def projetos_resumo(db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    q = db.query(models.Projeto).filter(models.Projeto.ativo == True)
    if usuario.perfil == "analista":
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
