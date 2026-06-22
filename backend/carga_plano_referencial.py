#!/usr/bin/env python3
"""
Carga do Plano de Contas Referencial a partir de PLANO DE CONTAS.xlsx (aba 2026).
Carga direta no banco — sem commit de release.
"""
import sys, os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, '.env'))

import openpyxl
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from models import Base, PlanoReferencial, ContaReferencial

XLSX_PATH = os.path.join(BACKEND_DIR, 'PLANO DE CONTAS.xlsx')

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    f'sqlite:///{os.path.join("C:\\", "emals-service", "emais_consultoria.db")}'
)

print(f"[DB] Conectando em: {DATABASE_URL[:80]}...")
engine = create_engine(DATABASE_URL)

# Garante que as tabelas ref_ existam (no-op se já existirem)
Base.metadata.create_all(engine)

with Session(engine) as session:

    # ── 1. PlanoReferencial ───────────────────────────────────────────────────
    plano = session.query(PlanoReferencial).first()
    if not plano:
        print("ERRO: Nenhum PlanoReferencial encontrado. Inicie o backend pelo menos uma vez para criar o seed.")
        sys.exit(1)
    print(f"OK  PlanoReferencial: id={plano.id}  '{plano.nome}'")

    # ── 2. Verificar dados existentes ─────────────────────────────────────────
    count_existente = session.query(ContaReferencial).filter_by(plano_id=plano.id).count()
    if count_existente > 0:
        resp = input(f"\nJa existem {count_existente} contas neste plano. Limpar e reimportar? (s/n): ")
        if resp.strip().lower() != 's':
            print("Cancelado.")
            sys.exit(0)
        # Limpa em duas passagens: filhos antes de pais (sem FK cascade no SQLite)
        session.execute(
            text("DELETE FROM ref_contas WHERE plano_id = :pid AND pai_id IS NOT NULL"),
            {"pid": plano.id}
        )
        session.execute(
            text("DELETE FROM ref_contas WHERE plano_id = :pid"),
            {"pid": plano.id}
        )
        session.commit()
        print(f"   {count_existente} contas removidas.\n")

    # ── 3. Ler xlsx ───────────────────────────────────────────────────────────
    print(f"[XLS] Lendo {XLSX_PATH}...")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb['2026']

    linhas = []
    for row in ws.iter_rows(values_only=True):
        classif, desc_raw, codigo_raw, tipo_raw = row[0], row[1], row[2], row[3]
        if classif is None or str(classif).strip() == 'Classificacao':
            continue
        if codigo_raw is None:
            continue
        linhas.append((str(classif).strip(), desc_raw, codigo_raw, tipo_raw))
    wb.close()
    print(f"     {len(linhas)} linhas de dados encontradas.\n")

    # ── 4. Inserir em ordem ───────────────────────────────────────────────────
    classif_to_id = {}   # classificacao_str -> ContaReferencial.id
    codigos_vistos = {}  # codigo -> primeira classif que o usou
    total = sinteticas = analiticas = n_subtrai = 0
    pulados = []
    erros = []

    for linha_num, (classif, desc_raw, codigo_raw, tipo_raw) in enumerate(linhas, start=2):
        try:
            descricao = (desc_raw or '').strip()
            codigo    = str(int(codigo_raw)).zfill(6)
            tipo      = 'sintetica' if tipo_raw == 'TT' else 'analitica'
            natureza  = None if tipo == 'sintetica' else ('subtrai' if '( - )' in descricao else 'soma')

            # Duplicata: primeira ocorrência vence
            if codigo in codigos_vistos:
                pulados.append(
                    f"Linha {linha_num}: codigo {codigo} ja usado por '{codigos_vistos[codigo]}' "
                    f"— '{classif}' ({descricao!r}) PULADO"
                )
                continue
            codigos_vistos[codigo] = classif

            # Pai: retira último segmento da Classificação
            parts   = classif.split('.')
            pai_id  = None
            if len(parts) > 1:
                pai_classif = '.'.join(parts[:-1])
                pai_id = classif_to_id.get(pai_classif)
                if pai_id is None:
                    erros.append(f"Linha {linha_num}: pai '{pai_classif}' nao encontrado -> '{classif}' ({codigo}) inserido sem pai")

            conta = ContaReferencial(
                plano_id=plano.id,
                codigo=codigo,
                descricao=descricao,
                tipo=tipo,
                natureza=natureza,
                pai_id=pai_id,
                agrupamento=None,
                ativo=True,
            )
            session.add(conta)
            session.flush()   # obtém o id antes do commit

            classif_to_id[classif] = conta.id
            total += 1
            if tipo == 'sintetica':
                sinteticas += 1
            else:
                analiticas += 1
                if natureza == 'subtrai':
                    n_subtrai += 1

        except Exception as e:
            session.rollback()
            erros.append(f"Linha {linha_num}: ERRO — {e} | ({classif}, {desc_raw!r}, {codigo_raw}, {tipo_raw})")

    session.commit()

    # ── 5. Relatório ──────────────────────────────────────────────────────────
    print("=" * 55)
    print("CARGA CONCLUIDA")
    print(f"   Total inserido : {total}")
    print(f"   Sinteticas (TT): {sinteticas}")
    print(f"   Analiticas     : {analiticas}")
    print(f"     -> soma      : {analiticas - n_subtrai}")
    print(f"     -> subtrai   : {n_subtrai}")
    print(f"   Pulados (dup.) : {len(pulados)}")
    print(f"   Erros          : {len(erros)}")
    if pulados:
        print("\nDUPLICATAS PULADAS (primeira ocorrencia foi mantida):")
        for p in pulados:
            print(f"   {p}")
    if erros:
        print("\nERROS:")
        for e in erros:
            print(f"   {e}")
    print("=" * 55)
