"""
Migração de dados: SQLite → Supabase (PostgreSQL)

Uso:
  1. Certifique-se que backend/.env tem DATABASE_URL apontando para o Supabase
  2. Execute: python migrar_para_supabase.py
"""
import sqlite3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = r"C:\emals-service\emais_consultoria.db"
PG_URL      = os.getenv("DATABASE_URL")

if not PG_URL or PG_URL.startswith("sqlite"):
    print("❌ DATABASE_URL no .env precisa apontar para o Supabase.")
    exit(1)

# Ordem garante que FKs sejam satisfeitas
TABELAS = [
    "usuarios",
    "clientes",
    "projetos",
    "fases",
    "tarefas",
    "subtarefas",
    "anotacoes",
    "planos",
    "clientes_planos",       # vinculo cliente ↔ plano
    "planos_itens",
    "template_formulas",
    "orcamento_valores",
    "orcamento_unidade_valores",
    "bandeiras",
    "import_layouts",
    "conta_de_para",
    "importacao_logs",
    "importacao_pendencias",
    "agrupadores_fc",
    "contas_fc",
    "log_atividades",
    "log_tarefas",
    "notificacoes",
    "mensagens_chat",
    "solicitacoes_reset",
    "arquivos",
    "modelos_projeto",
    "modelos_fases",
    "modelos_tarefas",
    "modelos_subtarefas",
]

def migrar():
    sq = sqlite3.connect(SQLITE_PATH)
    sq.row_factory = sqlite3.Row
    pg = psycopg2.connect(PG_URL)
    cur = pg.cursor()

    # Desabilita FKs temporariamente para importar em qualquer ordem
    cur.execute("SET session_replication_role = 'replica';")

    total_geral = 0

    for tabela in TABELAS:
        # Verifica se tabela existe no SQLite
        existe = sq.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabela,)
        ).fetchone()
        if not existe:
            print(f"  ⚠  {tabela} — não encontrada no SQLite, pulando")
            continue

        rows = sq.execute(f"SELECT * FROM {tabela}").fetchall()
        if not rows:
            print(f"  —  {tabela} — vazia")
            continue

        cols = list(rows[0].keys())
        col_names   = ", ".join(f'"{c}"' for c in cols)
        placeholders = ", ".join(["%s"] * len(cols))

        dados = [tuple(row) for row in rows]

        try:
            cur.executemany(
                f'INSERT INTO "{tabela}" ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
                dados
            )
            pg.commit()
            print(f"  ✅  {tabela} — {len(dados)} registros")
            total_geral += len(dados)
        except Exception as e:
            pg.rollback()
            print(f"  ❌  {tabela} — ERRO: {e}")

    # Reabilita FKs
    cur.execute("SET session_replication_role = 'origin';")

    # Resetar sequences para o próximo ID ser maior que o importado
    print("\n🔄 Resetando sequences de autoincrement...")
    cur.execute("""
        SELECT sequence_name FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    """)
    sequences = cur.fetchall()
    for (seq,) in sequences:
        tabela_base = seq.replace("_id_seq", "")
        try:
            cur.execute(f"""
                SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM "{tabela_base}"), 1))
            """)
        except Exception:
            pass
    pg.commit()

    cur.close()
    pg.close()
    sq.close()

    print(f"\n✅ Migração concluída — {total_geral} registros no total.")
    print("   Verifique as tabelas no Supabase → Table Editor.")

if __name__ == "__main__":
    print(f"📦 Lendo dados de: {SQLITE_PATH}")
    print(f"🎯 Destino: {PG_URL[:50]}...\n")
    confirma = input("Confirmar migração? (s/n): ")
    if confirma.lower() == "s":
        migrar()
    else:
        print("Cancelado.")
