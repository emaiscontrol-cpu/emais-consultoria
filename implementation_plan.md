# Plano de Implementação — Migração de Float para Numeric(15,2) — v2.6.4a

Este plano descreve o mapeamento das colunas numéricas de dinheiro no banco de dados, a proposta de alteração dos tipos de dados de `Float` para `Numeric(15, 2)` (evitando erros de precisão e arredondamento), e as estratégias de migração no startup do backend e coerção de tipos na API.

---

## Mapeamento e Classificação de Colunas `Float` (backend/models.py)

De acordo com as regras de negócio, as colunas foram classificadas em:
* **DINHEIRO:** Devem ser migradas para `Numeric(15, 2)`.
* **PERCENTUAL / PROGRESSO:** Devem permanecer como `Float`.

### Colunas Classificadas como [DINHEIRO] (A Migrar)

| Tabela (Classe Model) | Coluna | Descrição |
| --- | --- | --- |
| `lancamentos` (`Lancamento`) | `valor` | Valor real de uma receita ou despesa comercial |
| `orcamento_linhas` (`OrcamentoLinha`) | `valor_previsto` | Valor planejado de orçamento para projetos/categorias |
| `balancete_lancamentos` (`BalanceteLancamento`) | `valor` | Saldo/valor mensal de uma conta ERP importada do balancete |
| `importacao_pendencias` (`ImportacaoPendencia`) | `valor` | Valor de lançamento contábil sem De-Para associado |
| `ref_lancamentos` (`LancamentoRef`) | `valor` | Valor bruto de movimentação contábil para DRE |
| `fc_lancamentos` (`LancamentoFC`) | `valor` | Valor real de movimentação importada para Fluxo de Caixa Executivo |
| `fc_orcamento` (`FCOrcamento`) | `valor` | Valor orçado para Fluxo de Caixa Executivo |

### Colunas Classificadas como [PERCENTUAL] (NÃO Migrar)

| Tabela (Classe Model) | Coluna | Descrição |
| --- | --- | --- |
| `projetos` (`Projeto`) | `progresso` | Progresso global do projeto (0% a 100%) |
| `fases` (`Fase`) | `progresso` | Progresso da fase (0% a 100%) |
| `fases` (`Fase`) | `perc_desbloqueio` | Percentual mínimo para liberar a fase seguinte |
| `tarefas` (`Tarefa`) | `percentual` | Percentual de conclusão da atividade/tarefa |
| `modelos_fases` (`ModeloFase`) | `perc_desbloqueio` | Percentual padrão de desbloqueio do template |
| `ref_de_para` (`DeParaRef`) | `percentual` | Percentual de rateio da conta contábil (0% a 100%) |
| `ref_de_para` (`DeParaRef`) | `confianca` | Nível de confiança da sugestão da IA (0.0 a 1.0) |

---

## Proposta de Alterações

### 1. Alteração do models.py
Substituiremos `Float` por `Numeric(15, 2)` (importado de `sqlalchemy`) nas 7 colunas mapeadas acima como **DINHEIRO**.

### 2. Estratégia de Migração no Startup (backend/main.py)
* **PostgreSQL (Supabase):** Roda comandos incondicionais e tolerantes a falhas no startup, utilizando `ALTER TABLE ... ALTER COLUMN ... TYPE NUMERIC(15, 2) USING ROUND(coluna::numeric, 2)`.
* **SQLite (Dev/Local):** Como o SQLite possui suporte a *type affinity* e lida nativamente com coerção de floats para numéricos nas tabelas sem erros de type-matching complexos, apenas executaremos a atualização se a tabela existir, evitando quebrar o startup local do SQLite.

### 3. Tratamento de Tipos na API (Decimal vs Float)
Como o SQLAlchemy retornará objetos `decimal.Decimal` para colunas `Numeric`, faremos o seguinte:
* **Pydantic Schemas:** O Pydantic coage `decimal.Decimal` para `float` no JSON de resposta automaticamente quando o tipo de destino do Schema é `float`.
* **Cálculos e Operações:** Em Python, operações aritméticas que envolvem `float` e `Decimal` resultam em `TypeError`. Para resolver isso de forma robusta e limpa:
  * Manteremos os demonstrativos e cálculos internos operando predominantemente em `float` (para consistência de fórmulas do AST e math helpers, incluindo `_safe_eval`), convertendo os retornos do banco para `float` na camada do repositório/demonstrativo através de um helper de leitura.
  * O helper converterá qualquer valor `Decimal` para `float` antes de alimentar os motores de cálculo (como a geração da DRE e FC).
  * Exemplo de helper: `def parse_numeric(v) -> float: return float(v) if v is not None else 0.0`

---

## Janela de Homologação e Backup de Produção
Antes de aplicar as migrações em produção:
1. Validaremos no localhost que todas as tabelas foram criadas e as dependências operam sem erros.
2. Solicitaremos o log de diagnóstico do admin (`GET /api/admin/diagnostico`) para confirmar estabilidade.
3. Faremos um backup manual integral do banco de dados de produção antes do deploy.
