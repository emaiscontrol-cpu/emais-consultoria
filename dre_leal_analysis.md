# Análise da Planilha de Controladoria — Cliente Leal-MG (v2.6.2p)

Este documento detalha a estrutura, abas, contas e indicadores encontrados na planilha [Controladoria E+ Leal 1_Jan2026.xlsx](file:///C:/Users/luiz/Dropbox/Clientes/Leal-MG/DRE/Controladoria%20E+%20Leal%201_Jan2026.xlsx), servindo de base de escopo para a nova fase de evolução do sistema E Mais Consultoria.

---

## 1. Visão Geral do Arquivo

O arquivo possui **4 abas** estruturadas da seguinte forma:
1. **`DRE MENSAL`**: A aba principal. Trata-se de uma DRE Gerencial completa aberta em colunas para cada uma das **unidades/filiais** do cliente, com quebra por departamentos nas receitas, CMV e perdas, além de indicadores operacionais físicos no rodapé.
2. **`Plan1`**: Mapeamento de amarração contábil entre as contas contábeis e seus desdobramentos de ID.
3. **`Planilha1`** e **`Planilha2`**: Logs ou estruturas brutas de importação de sistemas de retaguarda (ERP/Contabilidade do cliente), onde cada linha possui registros separados por circunflexo (`^`).

---

## 2. Estrutura Detalhada da Aba `DRE MENSAL`

A aba contém **567 linhas** e **31 colunas**, organizando os resultados lado a lado por unidade de negócio.

### A. Filiais / Unidades em Colunas (Lado a Lado)
Cada filial possui duas colunas dedicadas: **Valor** e **% de Participação**. Identificamos as seguintes filiais (colunas 7 a 20+):
* **Roosevelt** (Colunas G e H)
* **Tibery** (Colunas I e J)
* **Mansour** (Colunas K e L)
* **Santa Mônica** (Colunas M e N)
* **Alvorada** (Colunas O e P)
* **Gravatas** (Colunas Q e R)
* **J. Holanda** (Colunas S e T)
* *E demais filiais/unidades totalizando até 31 colunas.*

---

### B. Hierarquia das Linhas e Fluxo de Caixa/DRE
A planilha desenha uma DRE operacional clássica enriquecida com visões departamentais e desembolsos de sócios:

1. **RECEITA BRUTA OPERACIONAL**
   - **Vendas à Vista:** Detalhado por formas de recebimento: *Dinheiro (311101)* e *Cheques à Vista (311102)*.
   - **Vendas à Prazo:** Detalhado por: *Cartões de Crédito (311104)*, *Cartão Débito (311105)*, *Convênio (311106)*, *Trocas (311107)*, *Contas a Receber Atual (311109)* e *PIX (311110)*.
   - **( - ) Cancelamentos e Descontos:** *Vendas Canceladas (312104)* e *Abatimentos (312106)*.
2. **VENDA LÍQUIDA DEPARTAMENTO (Linhas 27 a 46):**
   - Quebra a receita por departamento operacional (códigos `100` a `119`), incluindo:
     * *Açougue (100)*, *Bazar Geral (102)*, *Hortifruti (103)*, *Mercearia (104)*, *Mercearia Doce (105)*, *Bebidas (106)*, *Perfumaria (107)*, *Limpeza (108)*, *Padaria (109)*, *Perecíveis Congelados/Lácteos/Resfriados (111-113)*, *Tabacaria (115)*, etc.
3. **( - ) DEDUÇÕES DE RECEITA BRUTA:**
   - **Impostos sobre a Venda:** *ICMS (312101)*, *PIS (312102)*, *COFINS (312103)* e *Devoluções (312106)*.
   - **Impostos de Venda por Departamento:** Mapeamento tributário segmentado (códigos `200` a `219`).
4. **RECEITA LÍQUIDA DEPARTAMENTO:**
   - Margem segmentada limpa por departamento (códigos `300` a `319`).
5. **( - ) CMV - CUSTO DAS MERCADORIAS VENDIDAS (Linhas 110 a 134):**
   - Custo de mercadorias quebrado exatamente pelos mesmos departamentos contábeis (códigos `400` a `420`), deduzidos por estornos e créditos de PIS/COFINS.
6. **( - ) DESPESAS VARIÁVEIS:**
   - **Despesas com Vendas:** *Sacolas (332201)*, *Embalagens Açougue (332202)*, *Embalagens Rotisseria (332203)*, *Bandejas (332206)*, *Etiquetas (332207)*, etc.
   - **Despesas Financeiras de Venda:** *Taxas de Adm de Cartões (335109)*.
   - **Perdas:** *Perdas com Mercadorias (333209)* e perdas por departamento (códigos `500` a `519`).
7. **CUSTOS E DESPESAS FIXAS - DIRETOS (PESSOAL DA LOJA):**
   - **Remuneração:** *Salários (331102)*, *Horas Extras (331103)*, *Gratificações (331106)*, *Provisões Férias/13º (331104/5)*, insalubridade, adicionais.
   - **Encargos:** *INSS (331110)* e *FGTS (331109)*.
   - **Benefícios:** *Transporte (331202)*, *Assistência Médica (331203)* e *PAT/Refeição (331207)*.
8. **CUSTOS E DESPESAS FIXAS - DIRETOS - ADM:**
   - Despesas com pessoal administrativo rateado ou isolado por loja (códigos prefixados com `ADM`, ex: `ADM331102`).
9. **CUSTOS E DESPESAS FIXAS - INDIRETAS:**
   - *Despesas Tributárias (334101-334110)*.
   - *Utilidades:* Energia (333101), Água (333151), Telefonia/Internet, Gás.
   - *Manutenções:* Equipamentos, geradores, refrigeração, elevadores, elétrica/hidráulica.
   - *Informática:* Sistemas de Gestão (333406), suporte e infra.
   - *Honorários de Terceiros:* Consultorias, advocacia, contabilidade, limpeza de loja, vigilância, fretes.
10. **DESPESAS COM PROPAGANDA, VEÍCULOS E VIAGENS**
11. **( + ) OUTRAS RECEITAS OPERACIONAIS:**
    - Verbas de acordos comerciais com fornecedores (313206) e aluguel de espaços da loja (313292).
12. **RESULTADO FINANCEIRO E NÃO OPERACIONAL:**
    - Receitas de aplicações vs. Juros passivos e tarifas de Pix/cobrança (335101-335120).
13. **RESULTADO - DESEMBOLSOS DE SÓCIOS (Abaixo do Lucro Líquido):**
    - Desembolsos financeiros extra-operacionais: *Pró-Labore Sócios (605)* e *Gastos de Sócios Indedutíveis (607)*.

---

### C. Indicadores Físicos de Desempenho (Rodapé - Linhas 555 a 563)
A DRE calcula indicadores de produtividade por filial:
* **Número de Funcionários**
* **Faturamento por Funcionário** (Código `705`)
* **Metros Quadrados** (Área física da loja)
* **Faturamento por Metro Quadrado** (Código `706`)
* **Número de Clientes** (Fluxo/Passagem)
* **Ticket Médio** (Código `707`)
* **Número de PDVs** (Pontos de Venda / Checkouts)
* **Faturamento por PDV** (Código `708`)

---

## 3. Implicações e Requisitos para a Nova Fase do Sistema

Para integrar esta planilha e seus dados, o sistema E Mais precisará suportar:

1. **Visão Multilojas / Unidades de Negócio (Multi-tenant interno):**
   - Um único `cliente_id` (ex: Leal-MG) passará a conter múltiplas **Lojas/Filiais** (Roosevelt, Tibery, etc.).
   - A DRE Gerencial e demais demonstrativos precisarão de um filtro/seletor de **Loja** (permitindo consolidar tudo ou abrir as filiais em colunas, idêntico a este Excel).
2. **Estrutura de DRE por Departamentos:**
   - Habilidade de importar e expor quebras de receitas, CMV e perdas por setor (Mercearia, Açougue, FLV, Bebidas).
3. **Módulo de Indicadores Operacionais Físicos:**
   - Novo cadastro de variáveis físicas por loja/mês (número de funcionários, m² de área de vendas, número de PDVs, número de cupons/clientes).
   - Cálculos e exibições automáticas de ticket médio, faturamento/m² e faturamento/funcionário nos Dashboards.
