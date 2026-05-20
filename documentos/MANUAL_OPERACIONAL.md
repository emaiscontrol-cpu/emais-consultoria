# Manual Operacional — E Mais Consultoria
## Sistema de Gestão de Projetos

**Versão:** 1.0  
**Data:** Maio/2026  
**Público:** Todos os usuários do sistema

---

## ÍNDICE

1. [Acessando o Sistema](#1-acessando-o-sistema)
2. [Perfis de Usuário](#2-perfis-de-usuário)
3. [Dashboard — Tela Principal](#3-dashboard--tela-principal)
4. [Projetos](#4-projetos)
5. [Detalhe do Projeto — Fases e Tarefas](#5-detalhe-do-projeto--fases-e-tarefas)
6. [Fases](#6-fases)
7. [Tarefas](#7-tarefas)
8. [Subtarefas](#8-subtarefas)
9. [Clientes](#9-clientes)
10. [Usuários](#10-usuários)
11. [Notificações](#11-notificações)
12. [Relatórios](#12-relatórios)
13. [Histórico de Atividades](#13-histórico-de-atividades)
14. [Alterar Senha](#14-alterar-senha)
15. [Dicas Gerais](#15-dicas-gerais)
16. [Histórico de Versões](#16-histórico-de-versões)

---

## 1. Acessando o Sistema

### Como entrar

1. Abra o navegador (recomendado: Google Chrome)
2. Digite o endereço do sistema na barra de navegação
3. A tela de login será exibida com dois campos:
   - **Email:** digite seu endereço de e-mail cadastrado
   - **Senha:** digite sua senha
4. Clique no botão **Entrar**

> **Atenção:** Se aparecer a mensagem "Email ou senha inválidos", verifique se o email está correto (incluindo o domínio completo, ex: `nome@emaiscontrol.com.br`) e tente novamente.

### Como sair do sistema

No menu lateral esquerdo, role até o final e clique em **Sair**.

---

## 2. Perfis de Usuário

O sistema possui 4 perfis, cada um com permissões diferentes:

| Perfil | O que pode fazer |
|--------|-----------------|
| **Administrador** | Acesso total: projetos, clientes, usuários, relatórios, histórico |
| **Consultor** | Projetos, clientes, relatórios, histórico — não gerencia usuários |
| **Ger. Projeto** | Igual ao Consultor |
| **Cliente** | Visualiza apenas os projetos da sua empresa |

> O perfil é definido pelo Administrador no momento do cadastro.

---

## 3. Dashboard — Tela Principal

Ao fazer login, você é direcionado automaticamente para o **Dashboard**. Esta é a tela de visão geral do sistema.

### O que você vê no Dashboard

**Linha de métricas (4 cartões no topo):**
- **Total de Projetos** — quantidade de projetos cadastrados
- **Em Andamento** — projetos ativos no momento
- **Tarefas Pendentes** — tarefas que aguardam execução
- **Atrasados** — projetos ou tarefas fora do prazo

**Lista de projetos resumida:**  
Abaixo dos cartões, cada projeto aparece como um card com:
- Nome do projeto e cliente
- Barra de progresso mostrando o percentual concluído
- Status atual (ex: Em andamento, Concluído, Atrasado)
- Datas de início e previsão de término

**Para acessar um projeto** clique sobre o card desejado.

---

## 4. Projetos

### Como visualizar todos os projetos

Clique em **Projetos** no menu lateral esquerdo.

A lista exibe todos os projetos com:
- Nome e cliente
- Status (badge colorido)
- Progresso (barra percentual)
- Datas

### Como criar um novo projeto

1. Na tela de Projetos, clique no botão **+ Novo Projeto** (canto superior direito)
2. Preencha os campos:
   - **Nome do projeto** *(obrigatório)* — ex: "Implantação ERP Rede Forte"
   - **Cliente** *(obrigatório)* — selecione da lista de clientes cadastrados
   - **Status** — situação atual do projeto:
     - *Planejamento* — projeto ainda não iniciado
     - *Em andamento* — projeto em execução
     - *Pausado* — temporariamente parado
     - *Concluído* — projeto finalizado
   - **Data de início** — quando o projeto começa
   - **Previsão de término** — data esperada de conclusão
   - **Progresso (%)** — percentual manual de conclusão (0 a 100)
   - **Descrição** — informações adicionais sobre o projeto
3. Clique em **Salvar**

### Como editar um projeto

1. Na lista de projetos, clique no projeto desejado para abrir o detalhe
2. Clique no botão de edição (ícone de lápis) no cabeçalho
3. Altere os campos necessários
4. Clique em **Salvar**

### Como excluir um projeto

1. Abra o projeto desejado
2. Clique no ícone de lixeira
3. Confirme a exclusão na janela que aparecer

> **Atenção:** A exclusão de um projeto remove também todas as suas fases, tarefas e subtarefas. Esta ação não pode ser desfeita.

---

## 5. Detalhe do Projeto — Fases e Tarefas

Ao clicar em um projeto, você acessa a tela de detalhe, que mostra:

- **Cabeçalho:** nome, cliente, status, progresso e datas do projeto
- **Lista de fases:** cada fase é um bloco expandível
- **Dentro de cada fase:** as tarefas vinculadas

### Navegação

- Clique na **seta** ao lado do nome da fase para expandir/recolher as tarefas
- Cada tarefa pode ser expandida para ver subtarefas, comentários e detalhes

---

## 6. Fases

As fases representam as grandes etapas de um projeto (ex: Levantamento, Desenvolvimento, Testes, Entrega).

### Como criar uma fase

1. Na tela de detalhe do projeto, clique em **+ Nova Fase**
2. Preencha:
   - **Nome da fase** *(obrigatório)* — ex: "Fase 1 — Levantamento de Requisitos"
   - **Descrição** — detalhes sobre o objetivo da fase
   - **Data de início** e **Previsão de término**
   - **Dependência:**
     - *Livre* — a fase pode iniciar independentemente das demais
     - *Bloqueada pela anterior* — a fase só inicia quando a anterior atingir o percentual definido
   - **Desbloquear após (%)** — visível apenas se "Bloqueada": define qual percentual de conclusão da fase anterior libera esta fase (50%, 60%, 70%, 80%, 90% ou 100%)
3. Clique em **Salvar**

### Painel de opções da fase

Cada fase possui 3 botões de ação no canto direito do seu cabeçalho:

#### Botão Lápis (Editar)
Abre o painel de edição onde você pode alterar:
- Nome da fase
- Descrição
- Datas de início e término

Após editar, clique em **Salvar alterações**.

#### Botão Balão (Comentários)
Abre o painel de comentários da fase:
- Veja todos os comentários registrados com nome do autor e data/hora
- Para adicionar um comentário: digite no campo de texto e clique em **Enviar**

Use os comentários para registrar observações, decisões e atualizações importantes sobre a fase.

#### Botão Controles (Parâmetros)
Abre o painel de configuração de dependência:
- **Livre:** a fase não depende de nenhuma outra para avançar
- **Bloqueada pela anterior:** define que esta fase só pode progredir após a fase anterior atingir o percentual configurado
- Botões de percentual (50% a 100%) definem o limite de desbloqueio

Clique em **Salvar parâmetros** para confirmar.

### Status das fases

| Badge | Significado |
|-------|-------------|
| 🔵 Planejamento | Fase ainda não iniciada |
| 🟡 Em andamento | Fase em execução |
| 🔴 Atrasada | Prazo ultrapassado |
| 🟢 Concluída | Todas as tarefas concluídas |
| 🔒 Bloqueada | Aguardando fase anterior |
| ✅ Livre | Fase independente (sem bloqueio) |

---

## 7. Tarefas

As tarefas são as atividades específicas dentro de cada fase.

### Como criar uma tarefa

1. Dentro de uma fase (com as tarefas expandidas), clique em **+ Nova Tarefa**
2. Preencha:
   - **Nome da tarefa** *(obrigatório)* — ex: "Reunião de alinhamento com cliente"
   - **Responsável** — selecione o usuário responsável pela execução
   - **Data prazo** — prazo para conclusão
   - **Requer validação** — marque se a tarefa precisa de aprovação antes de ser concluída
3. Clique em **Adicionar**

### Status das tarefas

As tarefas possuem um fluxo de status que avança conforme o trabalho progride:

| Status | Descrição |
|--------|-----------|
| **Pendente** | Tarefa criada, aguardando início |
| **Em andamento** | Tarefa em execução |
| **Aguard. validação** | Concluída pelo responsável, aguarda aprovação |
| **Concluída** | Finalizada e aprovada |
| **Bloqueada** | Não pode avançar (fase bloqueada) |
| **Atrasada** | Prazo vencido sem conclusão |

### Como editar uma tarefa

1. Clique sobre a tarefa para expandi-la
2. Clique no ícone de **lápis** para abrir o painel de edição
3. Altere nome, responsável, prazo ou a opção de validação
4. Clique em **Salvar**

### Como alterar o percentual de conclusão

Dentro do painel de edição da tarefa, há um campo **% Concluído** — ajuste de 0 a 100 para refletir o progresso real.

### Como comentar em uma tarefa

1. Expanda a tarefa
2. Clique na aba **Comentários**
3. Digite o comentário e clique em **Enviar**

Os comentários ficam registrados com nome do autor e data/hora.

### Como adicionar responsáveis extras

Uma tarefa pode ter múltiplos responsáveis:
1. Expanda a tarefa
2. Clique em **+ Responsável**
3. Preencha nome, função, e-mail e telefone do responsável externo
4. Clique em **Adicionar**

### Como excluir uma tarefa

1. Expanda a tarefa
2. Clique no ícone de **lixeira**
3. Confirme a exclusão

---

## 8. Subtarefas

Subtarefas são itens menores dentro de uma tarefa — uma checklist de ações necessárias para concluí-la.

### Como criar uma subtarefa

1. Expanda a tarefa desejada
2. Clique na aba **Subtarefas** (ícone de lista)
3. Digite o nome da subtarefa no campo de texto
4. Opcionalmente, defina uma **data prazo**
5. Clique em **Adicionar**

### Como avançar o status de uma subtarefa

Cada subtarefa possui um botão quadrado colorido à esquerda — clique nele para avançar o status:

- **A fazer** (cinza) → clique → **Pendente** (amarelo) → clique → **Concluído** (verde) → clique → volta para **A fazer**

### Como excluir uma subtarefa

Clique no ícone de lixeira ao lado da subtarefa.

---

## 9. Clientes

O cadastro de clientes permite vincular projetos às empresas atendidas.

### Como visualizar clientes

Clique em **Clientes** no menu lateral (visível para Administradores, Consultores e Gerentes de Projeto).

### Como cadastrar um novo cliente

1. Clique em **+ Novo Cliente**
2. Preencha:
   - **Razão Social** *(obrigatório)* — nome oficial da empresa
   - **CNPJ** — cadastro nacional da pessoa jurídica
   - **Email** — e-mail de contato
   - **Telefone** — telefone principal
   - **Contato** — nome do responsável na empresa cliente
3. Clique em **Salvar**

### Como editar um cliente

1. Na lista de clientes, clique no ícone de lápis ao lado do cliente
2. Altere os campos necessários
3. Clique em **Salvar**

### Vinculando cliente a um projeto

Ao criar ou editar um projeto, o campo **Cliente** lista todos os clientes cadastrados. Selecione o cliente correspondente.

---

## 10. Usuários

Gerenciamento de usuários — disponível apenas para **Administradores**.

### Como visualizar usuários

Clique em **Usuários** no menu lateral (seção Administração).

A lista mostra nome, e-mail, perfil e status (ativo/inativo) de cada usuário.

### Como criar um novo usuário

1. Clique em **+ Novo Usuário**
2. Preencha:
   - **Nome completo** *(obrigatório)*
   - **Email** *(obrigatório)* — será usado para login
   - **Senha** *(obrigatório)* — mínimo 6 caracteres
   - **Perfil** *(obrigatório)*:
     - *Administrador* — acesso total
     - *Consultor* — acesso operacional completo
     - *Ger. Projeto* — gerenciamento de projetos
     - *Cliente* — acesso restrito aos próprios projetos
3. Clique em **Salvar**

> O usuário já pode fazer login imediatamente após o cadastro.

### Como editar um usuário

1. Clique no ícone de lápis ao lado do usuário
2. Altere nome, email ou perfil
3. Clique em **Salvar**

> Para alterar a senha de um usuário, o próprio usuário deve usar a função "Alterar Senha" no rodapé do menu lateral.

### Como desativar um usuário

Clique no ícone de lixeira ao lado do usuário e confirme. O usuário não conseguirá mais fazer login, mas seu histórico de atividades é preservado.

---

## 11. Notificações

O sistema monitora automaticamente os projetos e gera alertas para situações que precisam de atenção.

### Como acessar

Clique em **Notificações** no menu lateral. O número em vermelho sobre o ícone de sino indica quantos alertas não lidos existem.

### Tipos de alertas

| Alerta | Descrição |
|--------|-----------|
| **Tarefa atrasada** | Prazo vencido e tarefa não concluída |
| **Prazo próximo** | Tarefa com prazo nos próximos dias |
| **Aguardando validação** | Tarefa concluída aguardando aprovação |
| **Projeto atrasado** | Projeto com data prevista ultrapassada |

### Exportar notificações

Clique em **Exportar Excel** para baixar a lista de alertas em planilha.

---

## 12. Relatórios

A tela de Relatórios oferece visualizações gráficas do andamento dos projetos.

### Como acessar

Clique em **Relatórios** no menu lateral (seção Administração).

### Selecionar um projeto

No topo da tela, há um seletor **Projeto** — escolha o projeto que deseja analisar. Os gráficos atualizam automaticamente.

### Gráficos disponíveis

#### Status Geral (Gráfico de Rosca)
Mostra a distribuição de todas as tarefas do projeto em 3 categorias:
- 🟢 **Feito** — tarefas concluídas
- 🟡 **Em andamento** — tarefas em execução
- 🔴 **Parado** — tarefas pendentes ou bloqueadas

O centro do gráfico exibe o percentual total de conclusão.

#### Burndown
Gráfico de linha que compara o ritmo **ideal** versus o **real** de conclusão de tarefas ao longo do tempo:
- **Linha azul** — ritmo ideal (linear do início ao fim)
- **Linha vermelha** — ritmo real (baseado nas datas de conclusão registradas)

Se a linha vermelha estiver **acima** da azul, o projeto está atrasado em relação ao planejado.

#### Gantt — Linha do Tempo
Visualização das fases e tarefas em uma linha do tempo:
- Cada barra representa uma fase ou tarefa
- O comprimento da barra corresponde à duração planejada
- A cor interna indica o percentual concluído

#### Gráficos por Fase
Para cada fase do projeto, há um gráfico de rosca individual mostrando o status das tarefas daquela fase especificamente — útil para identificar quais fases precisam de atenção.

### Exportar relatório em Excel

No topo da tela de Relatórios, clique em **Exportar Excel**. O arquivo baixado contém 3 abas:
- **Projetos** — resumo de todos os projetos com status e progresso
- **Tarefas** — lista completa de tarefas com responsáveis e prazos
- **Histórico** — log das últimas 500 atividades do sistema

---

## 13. Histórico de Atividades

Registra todas as ações realizadas no sistema com data, hora, usuário e descrição.

### Como acessar

Clique em **Histórico** no menu lateral (seção Administração).

### Filtrar por projeto

No topo da tela, use o seletor **Projeto** para ver apenas as atividades de um projeto específico. Selecione "Todos os projetos" para ver o histórico completo.

### Informações exibidas

Cada linha do histórico mostra:
- **Data/Hora** — quando a ação ocorreu
- **Projeto** — projeto relacionado
- **Usuário** — quem realizou a ação
- **Ação** — tipo de evento (criou, atualizou, concluiu, etc.)
- **Descrição** — detalhes da ação

---

## 14. Alterar Senha

### Como alterar sua senha

1. No rodapé do menu lateral esquerdo, clique em **Alterar senha**
2. Uma janela será aberta com 3 campos:
   - **Senha atual** — sua senha de acesso atual
   - **Nova senha** — a nova senha desejada (mínimo 6 caracteres)
   - **Confirmar nova senha** — repita a nova senha
3. Clique em **Salvar**

> Se a senha atual estiver incorreta ou as senhas novas não coincidirem, o sistema exibirá uma mensagem de erro.

---

## 15. Dicas Gerais

### Menu lateral
- O menu lateral esquerdo (fundo azul escuro) é a navegação principal do sistema
- Itens com **badge vermelho** (ex: sino de notificações) indicam pendências que precisam de atenção
- O item ativo (página atual) aparece destacado com borda azul à esquerda

### Mensagens do sistema
- **Verde (sucesso):** ação realizada com sucesso
- **Vermelho (erro):** algo deu errado — leia a mensagem para entender o que ocorreu
- **Amarelo (aviso):** atenção necessária

### Boas práticas
- Mantenha os **percentuais de conclusão** das tarefas atualizados — eles alimentam os gráficos de Relatórios
- Use os **comentários** para registrar decisões e comunicações importantes — eles ficam no histórico
- Defina sempre **datas de prazo** nas tarefas — o sistema usa essas datas para gerar alertas de atraso
- Quando uma tarefa for concluída, marque o status como **Concluída** para que o progresso da fase seja atualizado automaticamente

---

## 16. Histórico de Versões

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | Maio/2026 | Versão inicial — documentação completa do sistema |

---

*Manual elaborado para o Sistema de Gestão E Mais Consultoria.*  
*Para suporte ou dúvidas, contate o administrador do sistema.*
