# Walkthrough — Conclusão da Fase 2 (DRE Multi-Unidades)

Este documento resume as implementações realizadas na **Fase 2 (Importação de 02 Modelos XLSX e Lógica de Unidades)** para o desenvolvimento do módulo de DRE Multi-Unidades.

---

## 1. O que foi Implementado

* **Tabela Unidades e Relacionamentos (`backend/models.py`):**
  - Criada a classe `Unidade` contendo `cliente_id` (ForeignKey), `codigo` (exatamente 3 dígitos numéricos), `nome` (ex: "Roosevelt"), `ativo` e `criado_em`.
  - Atualizado o modelo `LancamentoRef` para utilizar `unidade_codigo` (String(3)) em vez de nome direto para melhor integridade referencial.
* **Migração de Banco Automática no Startup (`backend/main.py`):**
  - SQLite/PostgreSQL configurados para criar a tabela `unidades` e injetar as colunas `coluna_unidade` e `coluna_inicio_unidades` em `import_layouts`, além do `unidade_codigo` em `ref_lancamentos` com a constraint de unicidade atualizada.
* **Endpoints de CRUD de Unidades (`backend/routers/ref_unidades.py`):**
  - Criados endpoints completos para listar, criar, editar e excluir filiais associadas a um cliente, com validações de unicidade de nome e código, e restrição de formato de código (exatamente 3 dígitos numéricos).
* **Resolução Dinâmica de Unidades na Importação (`backend/routers/ref_lancamentos.py`):**
  - Implementada a função inteligente `resolver_unidade`:
    - Se a planilha trouxer o código de 3 dígitos, o sistema associa diretamente (e cadastra provisoriamente se não existir).
    - Se a planilha trouxer o nome amigável (ex: "Roosevelt"), o sistema busca a filial pelo nome e descobre o código correspondente.
    - Se a filial não existir no cadastro do cliente, ela é **cadastrada dinamicamente de forma automática**! O sistema gera um código sequencial de 3 dígitos a partir de `100` (ex: `100`, `101`, `102`...) para que a importação prossiga sem erros e sem atritos ao usuário.
* **Parsers de XLSX Turbinados (`backend/xlsx_parser.py`):**
  - O parser `parse_xlsx` agora extrai e acopla a chave `"unidade"` nos três formatos de planilhas:
    1. Linear/Balancete contábil (`LINHA_MES_VALOR`).
    2. Tabular mensal (`COLUNAS_MESES`).
    3. Multiloja aberto em colunas (`COLUNAS_UNIDADES` - Modelo A, lendo os cabeçalhos das colunas dinamicamente).
* **Endpoint de Importação de Arquivos (`backend/routers/ref_lancamentos.py`):**
  - Adicionado o endpoint `@router.post("/importar-arquivo")` para receber o XLSX físico de DRE/Balancete do frontend, parsear os dados conforme o layout do cliente, resolver as filiais e salvar as informações com quebra de unidade.

---

## 2. Próximos Passos (Fase 3)

Na **Fase 3**, evoluiremos o **Motor De-Para e Fórmulas** para que o cálculo do template DRE consolidado e de colunas de filiais funcione perfeitamente a partir dos lançamentos particionados de `ref_lancamentos`.
