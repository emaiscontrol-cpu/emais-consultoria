# Registro de Validação — feature/dinheiro-numeric

Nesta fase de migração das colunas monetárias de dinheiro do tipo `Float` para `Numeric(15, 2)`, todas as tarefas foram concluídas com sucesso.

## Alterações Realizadas

1. **Alteração de Modelos (Tarefa 2):**
   * Migradas as seguintes 7 colunas em [models.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/models.py) de `Column(Float)` para `Column(Numeric(15, 2))`:
     * `Lancamento.valor`
     * `OrcamentoLinha.valor_previsto`
     * `BalanceteLancamento.valor`
     * `ImportacaoPendencia.valor`
     * `LancamentoRef.valor`
     * `LancamentoFC.valor`
     * `FCOrcamento.valor`
   * As demais colunas de percentuais e progresso continuaram como `Float` de acordo com a especificação técnica.

2. **Scripts de Migração no Startup (Tarefa 2):**
   * Adicionados os comandos `ALTER TABLE ... ALTER COLUMN ... TYPE NUMERIC(15, 2) USING ROUND(coluna::numeric, 2)` dentro do array de migrações automáticas de PostgreSQL/Supabase no startup em [main.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/main.py), de forma incondicional e tolerante a falhas (com rollback automático se houver erro transacional).

3. **Coerção de Tipos e Helpers na API (Tarefa 2):**
   * Cast explícito para `float` ao ler os valores de dinheiro do banco em rotas críticas onde os valores alimentam motores de fórmulas, loops aritméticos ou listas JSON:
     * Em [ref_demonstrativos.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/ref_demonstrativos.py) (na leitura de `valor_bruto` de `LancamentoRef`).
     * Em [controladoria.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/controladoria.py) (na soma e listagem de receitas/despesas e orçamentos).
     * Em [orcamento.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/orcamento.py) (nos valores mensais e auditoria do orçamento editável).
     * Em [balancete.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/balancete.py) (no retorno do dicionário de saldos).

4. **Registro de Rota de Testes (Tarefa 3):**
   * Importada e registrada a rota de `controladoria` em [tests/conftest.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/conftest.py) para viabilizar testes de controladoria automatizados.

---

## Validação Executada

### Testes Automatizados (Invariante de Soma de Centavos)
* Criado o caso de teste `test_invariante_soma_centavos` em [tests/test_api.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_api.py).
* Este teste insere 10 lançamentos de `0.10` e verifica se o resumo de receitas retorna exatamente `1.0` (invariante matemática que falhava anteriormente por conta da imprecisão de float binário IEEE 754).
* A suíte inteira de **73 testes passou com sucesso (100% verde)**.

### Startup Local
* O uvicorn foi iniciado localmente e as conexões e logs estruturados operam perfeitamente sem falhas.
