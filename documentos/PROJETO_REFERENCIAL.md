# Projeto Motor DE-PARA e Importação Referencial

> Documento-mestre do projeto. Ler antes de iniciar qualquer fase — mantém o desenho
> completo visível para sessões futuras, já que cada fase é implementada e validada
> separadamente (branch própria, aprovação do usuário antes do merge).
>
> ⚠️ **MODELO DEFINITIVO (2026-07):** esta versão substitui entendimentos anteriores. A
> mudança estrutural principal: **a DRE NÃO usa agrupamentos** — a linha-folha do template
> aponta DIRETO para as contas nativas do cliente. Agrupamento passa a ser exclusivo do
> Fluxo de Caixa. Ver "Contraste DRE × FC" abaixo. Os 24 agrupamentos de DRE criados na
> Fase A são **descartados**; os 74 agrupamentos de FC de produção ficam **intactos**.

## Objetivo

Vincular o plano de contas de cada cliente (ERP) aos TEMPLATES referenciais da E Mais,
importar valores mês a mês por unidade, conferir integridade e gerar demonstrativos
gerenciais (DRE, Fluxo de Caixa, Orçamento) apresentados ao vivo no sistema.

## Conceitos-chave (MODELO DEFINITIVO)

- **TEMPLATE REFERENCIAL**: cada demonstrativo (DRE, FC, Orçamento) tem seu template
  próprio. O template é REFERENCIAL — compartilhado entre clientes (por segmento), o que
  permite comparação/benchmark. **É o template que é a camada referencial** (não um
  plano-mestre de contas): clientes diferentes mapeiam suas contas às MESMAS linhas do
  template, e por isso "Margem Bruta" de um cliente é comparável com a de outro.

- **LINHA DE TEMPLATE = variável**. Toda linha é referenciável como `{linha:rotulo}` e tem
  um comportamento:
  - **APONTAMENTO (folha)**: a linha é um campo de VÍNCULO, nunca uma fórmula por célula.
    O que ela aponta depende do demonstrativo:
    - **DRE** → aponta DIRETO para N contas nativas do cliente (de-para conta→linha).
    - **FC** → aponta para 1 AGRUPAMENTO (os 74 de produção); `FcSlugDepara` liga
      movimento→agrupamento.
  - **soma_filhos (título)**: auto-soma das linhas-filhas diretas (por nível), sem fórmula.
  - **formula (totalizador)**: única forma que usa `{linha:...}` — avalia operações entre
    linhas (ex.: `Margem Bruta = {linha:receita_liquida} - {linha:custos_variaveis}`).
  Hierarquia por NÍVEL/indentação (1=A bloco, 2=C grupo, 3=D subgrupo, 4=E folha), não por
  campo pai manual.

- **PLANO NATIVO do cliente (`ContaClienteRef`)**: espelho fiel do plano de contas do ERP
  do cliente (código + descrição). Persistente e estável (muda pouco). Alimentado por
  importação (balancete com contas+valores) OU por export do ERP (só o plano). Serve de
  camada de segurança para conferências: detecta quando um arquivo importado traz conta que
  NÃO existe no Plano Nativo (ERP mudou ou veio lixo).

- **DEPARTAMENTO**: dimensão paralela (seções da loja: Açougue, Padaria...), origem
  "itens", totalizador por seção, com de-para próprio. Não é subconta.

- **Distinção entre demonstrativos** (qual template um cliente usa): definida no CADASTRO
  DO CLIENTE (contratação), não na conta.

- **Comportamento de tela (idêntico nos três)**: drill-down no padrão
  `PainelDetalheAgrupamento` — linha-pai abre filhas com gráfico rosca + evolução; cada
  linha é uma variável; totalizadoras somam filhas.

- **Regra de ouro do template**: o RELATÓRIO nunca é editado; só o TEMPLATE. Toda
  manutenção (inserir/editar/excluir linha, ver fórmulas) acontece no editor de template.

## Contraste DRE × FC — por que o vínculo é diferente [ESTRUTURAL]

| | **DRE** | **Fluxo de Caixa** |
|---|---|---|
| Folha do template aponta para | **N contas nativas do cliente** (direto) | **1 agrupamento** (dos 74) |
| Camada intermediária | nenhuma (conta → linha) | agrupamento (`FcSlugDepara`: movimento → agrupamento) |
| De-para | conta_cliente → linha_template | movimento/slug → agrupamento |

**Por quê:** no **Fluxo de Caixa** a MESMA conta pode ser entrada E saída conforme o
movimento (dinheiro que entra vs. sai) — não dá para mapear a conta estática a uma linha;
é preciso a camada de agrupamento, onde o MOVIMENTO (não a conta) é classificado. Já na
**DRE** a conta tem NATUREZA FIXA (uma conta de receita é sempre receita; CMV é sempre
custo) — então a conta mapeia estaticamente a uma linha, e o de-para direto conta→linha
basta, sem camada de classificação de movimento.

O modelo de FC (Rio das Pedras) **JÁ FUNCIONA em produção — não mexer.** Os 74 agrupamentos
de FC ficam intactos.

## Mapa de âncoras por demonstrativo [DEFINITIVO]

Cada demonstrativo tem seu **de-para próprio**, com uma âncora distinta — **sem
redundância** entre eles:

| Demonstrativo | A folha/linha ancora em | De-para (tabela) | Situação |
|---|---|---|---|
| **DRE** | linha do template (direto) | `DeParaDreLinha` (conta→linha) | **motor ✔ implementado e validado localmente** (PR #135) |
| **Fluxo de Caixa** | agrupamento (dos 74) | `FcSlugDepara` (movimento→agrupamento) | ✔ produção, intacto |
| **Balancete Gerencial** | `ContaReferencial` (plano-mestre) | `DeParaRef` (conta→conta_ref) | fase futura, fundação pronta |
| **Orçamento** | a definir | a definir | a definir |

- **`ContaReferencial` / `DeParaRef`: papel DEFINIDO — plano-mestre do Balancete Gerencial**
  (consumido hoje em `ref_lancamentos.py`, filtro por `agrupamento_slug`). **Mantidos e NÃO
  aposentados** — o Balancete entra como fase futura reaproveitando essa fundação.
- **`DeParaDreLinha` é EXCLUSIVO da DRE** e não substitui o `DeParaRef` (âncoras diferentes,
  demonstrativos diferentes).

## Status da etapa DRE

- **Motor (Camadas 1 e 1.5): IMPLEMENTADO e VALIDADO LOCALMENTE** (PR #135, Sessão 23). Folha soma direto as contas
  nativas vinculadas (`DeParaDreLinha`); totalizadores calculam a cadeia sozinhos.
  Validado com balancete de demonstração (Leal, jan/2026, unidade 101): cadeia
  `3.250 → 3.000 → 2.600 → 1.000 → 800 → −700` e rateios complexos de ADM (faturamento/percentual) e perdas presumidas.
  Todos os 111 testes da suíte estão verdes.
- **Editor de Templates (Fase A' evoluída): IMPLEMENTADO LOCALMENTE** (Sessão 24). Interface reestruturada com
  controles estruturais na grade (⬆️/⬇️ para reordenação, ⬅️/➡️ para recuo visual/indentação/outdent) e remoção
  dos inputs manuais de Modo de Cálculo, Nível e Ordem. Modo é calculado implicitamente. Adicionado filtro de
  busca para variáveis e inserção de nome limpo (sem chaves `{}`). Exibe visualizador colapsável de filhas para
  demonstrativos do tipo `soma_filhos`.
- **Próximos passos da etapa DRE (não concluída):**
  - **(a) UI de tratativa** do de-para direto conta→linha — evoluir a **Fase B / PR #132**
    (Preparo DE-PARA) para o modelo DRE (`DeParaDreLinha`): sugerir/confirmar/ignorar
    vínculos de conta nativa a linhas do template.
  - **(b) Importação real** (**Fase D**) — respeitando a ordem DE-PARA-antes-dos-valores
    (valor de conta sem vínculo fica retido).
- ⚠️ **O release da etapa DRE só acontece quando (a) e (b) estiverem prontos.** Hoje só o
  motor e o editor de templates estão prontos (semeadura manual serve para teste; não há entrada de dados pela UI).

## Camadas do template DRE [sequência de construção]

O template DRE real é construído em camadas incrementais:

- **Camada 1 [FEITA]**: **esqueleto estrutural** — as 56 linhas totalizadoras/subgrupos
  (níveis A/C/D/E; folha/soma_filhos/formula), com as fórmulas reais entre linhas. Motor
  aprende `*`, `/` e constantes numéricas.
  Seed: `backend/seed_dre_controladoria.py` (template "Controladoria - DRE Varejo",
  referencial universal por segmento).
- **Camada 1.5 [FEITA]**: **Configuração do Cliente** — parâmetros/constantes por cliente 
  (salva no Cadastro de Cliente), **regra de PRESUNÇÃO de perdas** e **MOTOR DE RATEIO configurável** 
  (distribui despesas ADM/matriz entre filiais por faturamento, percentual fixo, etc.).
- **Camada 2**: **folhas contábeis detalhadas** (≈321 contas analíticas) sob os subgrupos,
  com o de-para conta nativa → folha.
- **Camada 3**: **departamentos** (≈115, dimensão que se repete ~5×).

### Pendências explícitas da Camada 2

- **`devolucoes`: ajustar nível/hierarquia** para não somar 2× — hoje, pela hierarquia por
  indentação, `devolucoes` (folha, nível E) fica como filha de `impostos_venda`
  (soma_filhos), e ao mesmo tempo é somada pela fórmula de `deducoes`
  (`{linha:impostos_venda}+{linha:devolucoes}`). Inócuo na Camada 1 (tudo 0); ao entrar
  dados nas folhas contábeis, resolver para não contar `devolucoes` via soma_filhos de
  `impostos_venda` **e** via fórmula de `deducoes`.

## Fluxo (MODELO DEFINITIVO)

1. **Plano Nativo**: contas do cliente entram (import de balancete OU export do ERP).
2. **DE-PARA**: cada conta nativa é vinculada — na DRE, à linha-folha do template; no FC,
   ao agrupamento. Duas formas:
   - **Automática (lote)**: ao entrar contas novas, o motor sugere o vínculo; as que não
     casam ficam DESTACADAS.
   - **Manual (pontual)**: o usuário aponta o PARA conta a conta nas linhas destacadas.
3. **Ordem obrigatória — DE-PARA ANTES dos valores**: só grava os valores cujas contas já
   têm DE-PARA resolvido. Valor de conta sem vínculo fica RETIDO (não entra) até tratativa.
   Primeiro mês de um cliente = muita tratativa (onboarding); meses seguintes = quase
   automático (só contas novas).
4. **Conferência**: bate totais contábeis E departamentais; e verifica conta AUSENTE no
   Plano Nativo (sinal de mudança no ERP ou erro).
5. **Demonstrativo gerencial** ao vivo (drill-down).

**REGRA DE OURO:** nenhum valor é gravado no referencial sem DE-PARA resolvido da sua conta.

## Fases

- **A**: Reset e carga dos agrupamentos-padrão (DRE varejo). **[✔ concluída — PR #128]**
  → ⚠️ **REVISTA pelo modelo definitivo:** os 24 agrupamentos de DRE são DESCARTADOS (DRE
  não usa agrupamento). Os 74 agrupamentos de FC de produção permanecem intactos.
- **A′**: Editor de template evoluído (`modo_calculo` + nível) + Template DRE-espelho do
  cliente Leal. **[✔ concluída — PR #130]** → **parcialmente reaproveitada:** estrutura de
  template, hierarquia por nível, `soma_filhos` e `formula` seguem valendo; muda apenas o
  vínculo da FOLHA da DRE (de `agrupamento_slug` para de-para direto conta→linha). Ver o
  diagnóstico da sessão do modelo definitivo.
- **B**: Preparo DE-PARA de contas (tela de tratativa: vincular / incluir / ignorar).
  **[PR #132 aberta, não mergeada]** → precisará suportar o de-para direto conta→linha da DRE.
- **C**: Aderência de templates prontos (atalho para clientes com histórico).
- **D**: Importação multi-unidade mês a mês, respeitando a ordem DE-PARA-antes-dos-valores.
- **E**: Conferência automática de valores (autoexame — divergência zero) + checagem de
  conta ausente no Plano Nativo.
- **F**: Relatório de importados + edição (filtros, dois-cliques+confirmação, sem exclusão,
  zerar permitido).

> **Nota de escopo — tela "Plano de Contas" antiga:** a lógica antiga (740 contas sem
> vínculo + "Sugestão automática" por conta, hoje apontando para rota inexistente
> `/plano/importar`) será SUBSTITUÍDA pelo fluxo novo. Registrar como pendência de
> reescrita — não estender a tela antiga.

## Regra permanente

Nada de exclusão de dados financeiros — usuário zera. Toda conferência bate totais
contábeis E departamentais.
