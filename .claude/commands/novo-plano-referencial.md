---
description: Cria o módulo completo de Plano de Contas Referencial — banco, De-Para inteligente, templates de demonstrativos (DRE/Fluxo/Orçamento) com fórmulas, período/competência e benchmark anônimo por segmento
---

# Módulo de Plano de Contas Referencial e Demonstrativos

Você vai implementar o núcleo financeiro do sistema E Mais Consultoria: um plano de contas único e centralizado que serve de "moeda comum" entre todos os clientes, permitindo comparação e padronização de demonstrativos (DRE, Fluxo de Caixa, Orçamento), mesmo que cada cliente tenha seu próprio plano de contas no ERP de origem.

Leia o `CLAUDE.md` na raiz do projeto antes de começar, para seguir os padrões já estabelecidos (estrutura de pastas, convenções de nomenclatura, padrão de migração SQLite, estilo visual das páginas existentes).

## Conceito geral (contexto de negócio)

- Existe **um único** plano de contas referencial, compartilhado por todos os clientes.
- Cada cliente importa seus próprios lançamentos com o código de conta do ERP dele.
- Um **De-Para** vincula cada conta do cliente a uma ou mais contas do plano referencial (pode haver rateio percentual entre múltiplos destinos).
- O sistema sugere vínculos automaticamente comparando descrições (similaridade textual), aprendendo com vínculos já confirmados em outros clientes.
- Vínculos de alta confiança são aplicados automaticamente; os de baixa confiança também são aplicados, mas ficam sinalizados para revisão posterior do consultor — nunca bloqueiam o fluxo.
- O plano referencial pode crescer: se nenhuma conta existente servir, o consultor cria uma nova ali mesmo durante a revisão.
- Contas do plano são **Sintéticas** (agrupadoras, só somam o que está abaixo) ou **Analíticas** (recebem lançamento direto, têm Natureza Soma/Subtrai).
- **Templates** (DRE, Fluxo de Caixa, Orçamento) são montados por **Segmento de cliente** (ex: Varejo Alimentar, Drogarias, Cosméticos, Auto Peças, Outros — definido no cadastro do cliente). Um template serve a todos os clientes daquele segmento.
- Cada linha de um template tem uma fórmula que pode combinar múltiplos agrupamentos do plano referencial com os operadores `+ − × ÷` e parênteses, incluindo números fixos (ex: multiplicar por 100 para obter percentual).
- Uma linha de template já calculada vira ela mesma uma variável disponível para fórmulas de linhas seguintes (cálculo em cascata, como uma planilha).
- Tudo tem período/competência (mês/ano) — lançamentos, De-Para (versionado por data de vigência) e demonstrativos calculados.

## O que fazer, em ordem

### 1. Modelagem de dados (backend)

Criar as seguintes entidades, seguindo o padrão de migração já usado em `main.py`:

- **`PlanoReferencial`**: praticamente singleton (haverá só um registro ativo), mas modelado como tabela para permitir evolução futura.
- **`ContaReferencial`**: código, descrição, nível hierárquico implícito pelo código, `tipo` (sintética/analítica), `natureza` (soma/subtrai — preenchido somente quando `tipo = analítica`), conta pai (auto-relacionamento para hierarquia).
- **`Segmento`**: nome (Varejo Alimentar, Drogarias, Cosméticos, Auto Peças, Outros — popular esses 5 como seed inicial, mas permitir cadastro de novos).
- Adicionar campo `segmento_id` ao modelo `Cliente` existente (FK para `Segmento`).
- **`ContaCliente`**: código de origem, descrição de origem, cliente_id (FK).
- **`DePara`**: conta_cliente_id (FK), conta_referencial_id (FK), `percentual` (decimal, para suportar rateio — a soma dos percentuais de uma mesma conta_cliente deve ser validada para não ultrapassar 100%), `status` (`confirmado` / `pendente_revisao`), `confianca` (decimal 0-1), `origem_vinculo` (`sugestao_automatica` / `manual` / `aprendido_de_outro_cliente`), `vigente_a_partir` (data — para versionamento; ao criar um novo De-Para para a mesma conta_cliente, o anterior não é apagado, apenas perde vigência).
- **`Lancamento`**: conta_cliente_id (FK), valor, competencia (mês/ano), data_importacao.
- **`Template`**: tipo (`dre` / `fluxo_caixa` / `orcamento`), segmento_id (FK), nome.
- **`TemplateLinha`**: template_id (FK), rotulo, ordem, `negrito_totalizador` (boolean), `formula_texto` (a expressão editável, ex: `( {agrupamento:receita_liquida} - {agrupamento:cmv} ) / {agrupamento:receita_liquida} * 100`).
- **`PeriodoFechado`**: cliente_id (FK), competencia, data_fechamento, usuario_id (quem fechou) — quando um período está fechado, bloquear nova importação de lançamentos para aquela competência sem confirmação explícita de reabertura.

### 2. Motor de sugestão do De-Para

Implementar como serviço backend separado (não misturar com a lógica de rotas):

- Comparação de similaridade textual entre `descricao_origem` da conta do cliente e `descricao` das contas referenciais analíticas (usar uma biblioteca madura de fuzzy matching/similaridade de string já disponível no ecossistema Python, ex. `rapidfuzz` ou equivalente leve — escolha a mais adequada ao que já está instalado no projeto).
- Antes de comparar com o plano inteiro, verificar se já existe um De-Para `confirmado` com descrição de origem muito similar em **outro cliente** — se sim, usar isso como sinal de reforço de confiança (boost no score), e marcar `origem_vinculo = aprendido_de_outro_cliente` quando for esse o caso.
- Definir um limiar de confiança (ex: acima de 80% = alta confiança, abaixo = baixa). Ambos os casos geram um registro em `DePara` com `status` adequado — a diferença é apenas o `status` e a sinalização visual, nunca o bloqueio do fluxo.
- Score de confiança e contagem de "usado em N clientes" devem ser retornados pela API para exibição na tela de revisão.

### 3. Backend — endpoints

Crie os endpoints REST necessários para:
- CRUD do plano referencial e suas contas (incluindo endpoint de "criar sub-conta" que já preenche código e pai corretos a partir da conta selecionada)
- CRUD de segmentos
- Importação de lançamentos do cliente (upload de arquivo, parsing, criação de `ContaCliente` para códigos não vistos antes, dispara o motor de sugestão automaticamente para contas novas)
- Listagem de De-Para pendentes de revisão, com filtro por cliente
- Confirmar/trocar/ratear um De-Para (suporta múltiplas linhas de rateio numa só operação)
- CRUD de templates e suas linhas, incluindo validação de fórmula:
  - Validar sintaticamente a expressão (parênteses balanceados, operadores válidos)
  - **Detectar referência circular entre linhas** (ex: linha A depende de linha B que depende de linha A) e rejeitar o salvamento com mensagem clara apontando o ciclo
  - Resolver automaticamente a ordem de cálculo das linhas a partir das dependências entre elas (não depender da ordem visual em que foram criadas)
- Endpoint de "duplicar template para outro segmento"
- Cálculo do demonstrativo: dado cliente + template + competência, retorna cada linha calculada. Em caso de divisão por zero numa fórmula, retornar o valor da linha como zero e incluir um flag `tem_divisao_por_zero: true` naquela linha, sem lançar erro
- Fechamento de período (bloqueia reimportação de lançamentos para aquela competência/cliente, exige confirmação explícita para reabrir)
- Comparativo realizado vs orçado: dado um cliente e competência, retorna lado a lado os valores do template tipo `dre`/`fluxo_caixa` (realizado) e do template tipo `orcamento` (planejado) com o desvio percentual por linha, assumindo que ambos os templates do mesmo segmento compartilham a mesma estrutura de linhas
- Endpoint de benchmark: dado um segmento e competência, retorna média/faixa (min-max) de margem bruta, margem líquida e CMV-sobre-receita entre os clientes daquele segmento, **sem identificar nenhum cliente individualmente** — apenas valores agregados anônimos

### 4. Frontend — telas

Seguindo o padrão visual já estabelecido no projeto (ver páginas de dashboard existentes como referência de estilo):

- **Plano de contas referencial**: tabela hierárquica com indentação por nível, colunas Conta/Descrição/Tipo (sintética/analítica)/Natureza (soma/subtrai, só visível em analíticas), botões de ação (editar, criar sub-conta, excluir), botão de importar plano via XLSX/CSV
- **Revisão de De-Para**: duas visualizações na mesma tela, alternáveis por abas — (a) lista de pendências com badge de confiança e contagem "usado em N clientes", botões aceitar/trocar; (b) modo lado a lado (plano do cliente | plano referencial) com interação de arrastar para vincular, suportando rateio (ao segurar uma tecla modificadora, permite vincular a uma segunda conta com percentual)
- **Editor de templates**: lista de linhas editável estilo planilha, cada linha com campo de rótulo e uma barra de fórmula onde os agrupamentos aparecem como chips conectados por operadores (+ − × ÷) e parênteses, com painel lateral de variáveis disponíveis (agrupamentos do plano + linhas já calculadas do próprio template, claramente diferenciadas visualmente), suporte a arrastar variáveis da lateral para a fórmula, edição também por digitação direta, indicador visual discreto nas linhas que tiveram divisão por zero em algum cliente, botão de duplicar template para outro segmento
- **Visualização do demonstrativo** (DRE/Fluxo/Orçamento calculado): tabela com as linhas do template já calculadas para o cliente e competência selecionados, linhas totalizadoras em destaque visual, seletor de competência, comparativo realizado vs orçado quando aplicável
- **Benchmark de segmento**: tela simples mostrando os 3 indicadores (margem bruta, margem líquida, CMV/receita) com média e faixa do segmento, sem listar clientes individuais

### 5. Permissões

- Plano referencial, segmentos e templates: visíveis e editáveis apenas por perfis `admin` e `consultor`.
- Revisão de De-Para: visível e editável por `admin` e `consultor`.
- Demonstrativos calculados (DRE/Fluxo/Orçamento do próprio cliente): visíveis para o cliente conforme módulo "Análises Gerenciais" contratado (reaproveitar a lógica de módulo já implementada no projeto), mas o cliente nunca edita nada nessa área — somente visualiza.
- Benchmark de segmento: visível apenas para `admin` e `consultor` (não expor a clientes nesta fase, já que envolve dados agregados de outros clientes do mesmo segmento).

### 6. Sidebar e navegação

Adicionar os itens correspondentes dentro da seção "Análises Gerenciais" já existente na sidebar (ver `Sidebar.jsx`), seguindo o padrão visual já estabelecido (incluindo a lógica de módulo bloqueado/visível para clientes que não têm o módulo contratado, e a tela "Saiba mais" quando aplicável). Para os perfis internos (`admin`/`consultor`), adicionar também acesso a Plano Referencial, Templates e Revisão de De-Para — provavelmente como uma sub-área de configuração, já que são telas de manutenção, não de consumo do cliente.

## Fora do escopo desta skill (não implementar agora)

- Validação de balanceamento contábil (débito = crédito) — isso pertence ao futuro módulo de Balanço Patrimonial, não a este.
- Exportação de demonstrativos em PDF/Excel.
- Log de auditoria de alterações em De-Para e templates.

## Ao finalizar

1. Liste todos os arquivos criados ou modificados, organizados por: banco de dados, backend (serviços e endpoints), frontend (telas e componentes)
2. Rode as migrações e confirme que não há erro
3. Aponte qualquer ponto que precise de decisão humana antes de seguir (ex: qual biblioteca de similaridade textual foi escolhida e por quê, limiar de confiança usado)
4. Pergunte se o usuário quer popular dados de teste (um cliente fictício com plano de contas próprio e alguns lançamentos) para validar o fluxo ponta a ponta no Electron antes de seguir para outros clientes reais
5. NÃO faça commit nem release automaticamente — isso é feito separadamente com `/release`
