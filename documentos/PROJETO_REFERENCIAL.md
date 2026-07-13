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

## Plano Nativo do Cliente (cadastro de apoio) [NOVO CONCEITO]

- A tabela `ContaClienteRef` é o "Plano Nativo": espelho fiel do plano de contas do ERP
  do cliente (código + descrição). É persistente e estável (muda pouco).
- Serve de camada de segurança para conferências: permite detectar quando um arquivo
  importado traz conta que NÃO existe no Plano Nativo (ERP mudou ou veio lixo).

## Fluxo

Plano Cliente → DE-PARA (contas + departamentos) → Aderência a Template → Popular
lançamentos (cliente/unidade/mês) → Conferência de valores → Demonstrativo gerencial.

## Duas portas de entrada do Plano Nativo

- **Porta A — Export do ERP**: arquivo só com o plano de contas (sem valores), carregado
  de uma vez. Ideal para onboarding de cliente novo. É uma FORMA A MAIS de importação
  (upload de arquivo, sem conexão a banco de ERP).
- **Porta B — Junto do arquivo de valores**: quando o cliente manda um balancete com
  contas+valores, o sistema extrai as contas e alimenta o Plano Nativo antes de gravar
  valores.

## Duas formas de fazer o DE-PARA

- **Automática (em lote)**: ao entrar contas novas no Plano Nativo, o `depara_service`
  tenta casar com o PR. As que não casam ficam DESTACADAS.
- **Manual (pontual)**: no cadastro do Plano Nativo / tela de Preparo, o usuário vê as
  linhas destacadas (sem vínculo) e aponta o PARA ali mesmo, conta a conta.

## Ordem obrigatória: DE-PARA ANTES dos valores [REGRA]

Sequência ao importar um balancete com contas+valores:
1. Monta/atualiza o Plano Nativo (contas do arquivo).
2. Roda DE-PARA (automático); contas sem match ficam retidas/destacadas para tratativa.
3. SÓ grava os valores cujas contas já têm DE-PARA resolvido. Valor de conta sem vínculo
   fica RETIDO (não entra) até o usuário tratar.

**REGRA DE OURO:** nenhum valor é gravado no referencial sem DE-PARA resolvido da sua
conta. Primeiro mês de um cliente = muita tratativa (onboarding); meses seguintes =
quase automático (só contas novas).

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

## Conferência (Fase E) — checagem adicional

Além de cruzar totais contábeis e departamentais: verificar se o arquivo trouxe conta
AUSENTE no Plano Nativo (sinal de mudança no ERP ou erro). Uma conta que aparece no
arquivo importado mas não existe no Plano Nativo do cliente é um alerta — pode ser conta
nova do ERP (tratar/incluir) ou lixo (rejeitar).

## Ajuste de escopo — tela "Plano de Contas" antiga

A lógica antiga da tela de Plano de Contas (740 contas sem vínculo + botão "Sugestão
automática" por conta) será SUBSTITUÍDA pelo fluxo novo (agrupamentos via DE-PARA).
Registrar como pendência de reescrita numa fase futura — não estender a tela antiga.

## Regra permanente

Nada de exclusão de dados financeiros — usuário zera. Toda conferência bate totais
contábeis E departamentais.
