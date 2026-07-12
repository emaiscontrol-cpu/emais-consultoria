# Projeto Motor DE-PARA e Importação Referencial

> Documento-mestre do projeto. Ler antes de iniciar qualquer fase — mantém o desenho
> completo visível para sessões futuras, já que cada fase é implementada e validada
> separadamente (branch própria, aprovação do usuário antes do merge).

## Objetivo

Vincular o plano de contas de cada cliente (ERP) ao Plano Referencial (PR) da E Mais,
importar valores mês a mês por unidade, conferir integridade e gerar demonstrativos
gerenciais (DRE, Balancete, Orçamento) apresentados ao vivo no sistema.

## Conceitos-chave

- **AGRUPAMENTO**: variável de entrada. Balde onde caem as contas do cliente via DE-PARA.
  Referenciado em fórmulas como `{agrupamento:nome}`. Ex.: `rec_avista`, `cmv`,
  `encargos_remun`.
- **LINHA DE TEMPLATE**: toda linha é uma variável (referenciável como `{linha:rotulo}`)
  com um `modo_calculo`:
  - `'agrupamento'`: linha-folha, puxa 1 agrupamento (nível E, último nível — sempre folha).
  - `'soma_filhos'`: linha-título, auto-soma das linhas-filhas diretas (sem fórmula).
  - `'formula'`: linha-totalizador, avalia `formula_texto` com operações entre
    linhas/agrupamentos (ex.: subtração de margem).
  Hierarquia definida por NÍVEL/indentação (1=A, 2=C, 3=D, 4=E), não por campo pai manual.
  O sistema infere o modo na importação: nível E → agrupamento; título com SUM contíguo →
  soma_filhos; título com operação → formula.
- **DEPARTAMENTO**: dimensão paralela (seções da loja: Açougue, Padaria...), origem
  "itens", totalizador por seção, com de-para próprio. Não é subconta.
- **Distinção DRE/Balancete/Orçamento**: definida no CADASTRO DO CLIENTE (contratação),
  não na conta.
- **Comportamento de tela**: reusa o padrão do FC Inteligente (`PainelDetalheAgrupamento`)
  — linha-pai abre filhas com gráfico rosca+evolução.
- **Regra de ouro**: o RELATÓRIO nunca é editado; só o TEMPLATE. Toda manutenção
  (inserir/editar/excluir linha, fórmulas visíveis) acontece no editor de template.

## Fluxo

Plano Cliente → DE-PARA (contas + departamentos) → Aderência a Template → Popular
lançamentos (cliente/unidade/mês) → Conferência de valores → Demonstrativo gerencial.

## Fases

- **A**: Reset e carga dos agrupamentos-padrão (DRE varejo). **[✔ concluída — PR #128]**
- **A′**: Editor de template evoluído (`modo_calculo` + nível) + Template DRE-espelho do
  cliente Leal (fórmulas reais). **[✔ concluída — PR #130]**
- **B**: Preparo DE-PARA de contas (tela em Procedimentos → Plano de Contas Referencial),
  com tratativas: incluir no PR / vincular / ignorar.
- **C**: Aderência de templates prontos (atalho para clientes com histórico).
- **D**: Importação multi-unidade mês a mês (DRE/Balancete/Orçamento sinalizado).
- **E**: Conferência automática de valores (autoexame — ponto crítico, divergência zero).
- **F**: Relatório de importados + edição (filtros, dois-cliques+confirmação, sem
  exclusão, zerar permitido).

## Regra permanente

Nada de exclusão de dados financeiros — usuário zera. Toda conferência bate totais
contábeis E departamentais.
