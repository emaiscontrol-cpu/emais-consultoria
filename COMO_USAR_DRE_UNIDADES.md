# Guia de Uso — Módulo DRE Multi-Unidades

Este guia descreve como utilizar e testar as novas funcionalidades do módulo de DRE e Comparativos com quebra de Unidades Contábeis (filiais) no sistema E Mais Consultoria.

---

## 1. Cadastro e Gestão de Unidades (Filiais)

O primeiro passo para segmentar os demonstrativos é gerenciar as unidades do cliente.

* **Onde fica:** No menu lateral do sistema, sob o menu do Cliente (Configurações / Cadastro de Unidades).
* **Como usar:**
  1. Clique em **"Novo"** para cadastrar uma unidade.
  2. Insira o **Código** (deve possuir exatamente 3 dígitos numéricos, ex: `100`, `101`, `104`).
  3. Insira o **Nome** da filial (ex: `Roosevelt`, `Tibery`).
  4. Marque se ela está **Ativa**.
  5. Clique em **"Salvar"**.
* **Edições e Exclusão:** Você pode editar o nome ou desativar filiais diretamente na tabela de listagem.

---

## 2. Configuração do Layout de Importação Contábil

Para que o importador saiba ler as filiais a partir das planilhas de balancete do ERP ou de relatórios gerenciais, você deve configurar o layout.

* **Onde fica:** Menu **Importações** -> aba **Layouts de Importação**.
* **Como configurar:**
  * **Modelo A (Multiloja - Filiais nas Colunas):** 
    Se você possui uma planilha em que cada filial é uma coluna (ex: Roosevelt na coluna G, Tibery na coluna I, etc.), marque o tipo de layout como **"Colunas por Unidade"**.
    * Informe o número da **Linha onde iniciam os nomes das filiais** (Cabeçalho de Unidades).
    * Informe a **Coluna de início** das fatias (onde começa a primeira loja).
  * **Modelo B (Linear - Código da Filial na Linha):**
    Se a planilha é um balancete com a coluna identificadora da filial em cada linha:
    * Defina a **Coluna da Unidade** (ex: Coluna `D` ou número da coluna) que contém o código de 3 dígitos da filial ou o seu nome.

---

## 3. Importação do Arquivo XLSX Contábil

* **Onde fica:** Menu **Importações** -> aba **Lançamentos** ou **Realizado**.
* **Como usar:**
  1. Selecione o **Cliente** (ex: `Leal-MG`) e o **Layout de Importação** configurado.
  2. Informe o **Ano** (ex: `2026`) e selecione a competência (**Mês**).
  3. Faça o upload do arquivo contábil `.xlsx`.
  4. Clique em **"Importar Arquivo"**.
* **O que acontece por trás:**
  * O parser lê o arquivo e resolve o identificador de unidade de cada lançamento.
  * **Inteligência de Auto-Cadastro:** Se o importador encontrar um nome de filial não cadastrado no banco (ex: "Gravatas"), ele **cadastra a filial automaticamente** no cliente gerando um código de 3 dígitos sequencial a partir de `100` (ex: `100`, `101`, `102`...). A importação conclui com sucesso sem interrupções!

---

## 4. Visualização e Análise do Demonstrativo (DRE / Comparativo)

* **Onde fica:** Menu **Demonstrativo Gerencial**.
* **Como usar:**
  1. Selecione o **Cliente** (ex: `Leal-MG`) e o **Template** (ex: `DRE Padrão Leal`).
  2. Escolha a **Filial / Unidade**:
     * **Consolidado (Vazio):** Renderiza a tabela dinâmica exibindo colunas de todas as filiais lado a lado com a coluna do total Consolidado na ponta.
     * **Filial Específica (ex: Roosevelt):** Renderiza apenas a coluna daquela filial focada.
  3. Escolha o **Mês** e **Ano** (ex: `Jan` / `2026`).
  4. Clique em **"Calcular"**.

---

## 5. Grid Interativo de Edição In-line (Ajustes de Células)

Caso queira fazer ajustes contábeis rápidos diretamente na DRE sem precisar reimportar balancetes:

* **Onde fica:** Na própria grade da tabela dinâmica de visualização da DRE.
* **Como usar:**
  1. Posicione o cursor sobre o valor de uma filial em uma **linha analítica** (que não seja um totalizador em negrito). O cursor mudará para formato de clique interativo.
  2. Dê um **duplo clique** sobre a célula.
  3. A célula se transformará em um campo de texto ativo. Digite o novo valor (ex: `150000.00`).
  4. Pressione **Enter** ou clique fora da célula (evento **Blur**).
* **O que acontece por trás:**
  * O sistema envia a alteração ao backend.
  * Se a linha editada (ex: CMV) já estiver associada a uma conta do cliente via De-Para, o valor do lançamento correspondente a essa conta contábil e filial é atualizado.
  * Se for um cliente recém-criado sem De-Para cadastrado para o CMV, o sistema **cria dinamicamente uma conta cliente de ajustes** e cria o De-Para em tempo real, concluindo a gravação com sucesso.
  * A DRE é recalculada na mesma hora, atualizando os lucros, margens % e o consolidado da tela na mesma fração de segundo!
