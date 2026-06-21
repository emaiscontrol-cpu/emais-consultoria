---
description: Cria um módulo completo em qualquer projeto — router backend, modelos, schemas, migração, página frontend, rota e sidebar
argument-hint: <nome-do-modulo> [descrição curta]
allowed-tools: [Read, Edit, Write, Glob, Grep, Bash]
---

# Novo Módulo

Cria um módulo completo a partir do zero. Argumento: $ARGUMENTS

## Passo 1 — Entender o escopo

Antes de criar qualquer arquivo, pergunte ao usuário (se não estiver claro):
- Qual o nome do módulo e qual problema ele resolve?
- Quais perfis/roles terão acesso?
- Precisa de nova tabela no banco ou só novos campos?
- Aparece na navegação (sidebar/menu)? Em qual seção?
- Quais operações são necessárias? (listar, criar, editar, deletar)

## Passo 2 — Backend: Modelo

Se precisar de nova tabela, criar em `models.py` (ou equivalente do projeto):
- Incluir `id` como chave primária
- Incluir `criado_em` com `server_default`
- Se multi-tenant: incluir FK para a entidade de cliente/organização

## Passo 3 — Backend: Schema / Serialização

Criar schemas de entrada (Create/Update) e saída (Out/Response):
- Campos obrigatórios vs opcionais bem definidos
- Schema de saída com `from_attributes = True` (Pydantic) ou equivalente

## Passo 4 — Backend: Router / Controller

Criar arquivo de rotas com CRUD completo:
- Proteger todos os endpoints com autenticação
- Aplicar filtro de escopo (tenant/organização) em listagens
- Retornar sempre o objeto atualizado após salvar

## Passo 5 — Backend: Registrar o router

Incluir o novo router no ponto de entrada da aplicação (`main.py` ou equivalente).

## Passo 6 — Migração de banco

Se adicionou coluna em tabela existente:
- Verificar se o projeto usa migrações automáticas (Alembic, Prisma, etc.) ou manuais
- Criar migração seguindo o padrão já usado no projeto
- Testar que a migração é idempotente (pode rodar mais de uma vez sem erro)

## Passo 7 — Frontend: Serviço de API

Adicionar funções de chamada à API no arquivo de serviços do projeto (ex: `api.js`, `services/modulo.ts`):
- `listar`, `buscarPorId`, `criar`, `atualizar`, `deletar`
- Usar o cliente HTTP já configurado no projeto (nunca `fetch` direto)

## Passo 8 — Frontend: Página / Componente

Criar a página seguindo os padrões visuais do projeto:
- Estado de loading enquanto carrega dados
- Tratamento de erros com feedback para o usuário (toast, alert, etc.)
- Usar componentes compartilhados do projeto (Modal, Table, Form, etc.)
- Nunca hardcodar cores ou tamanhos — usar as variáveis/tokens do design system

## Passo 9 — Frontend: Rota

Registrar a rota no roteador do projeto (React Router, Next.js, Vue Router, etc.):
- Aplicar guard de autenticação se necessário
- Nomear a rota seguindo o padrão já usado no projeto

## Passo 10 — Frontend: Navegação

Adicionar link na sidebar/menu principal:
- Respeitar as regras de visibilidade por perfil já existentes
- Usar o ícone e estilo consistente com os outros itens do menu

## Passo 11 — Verificação final

- [ ] Modelo criado com todos os campos necessários
- [ ] Schema de entrada e saída definidos
- [ ] Router com CRUD completo e autenticação
- [ ] Router registrado no ponto de entrada
- [ ] Migração criada e testada
- [ ] Serviço de API adicionado
- [ ] Página criada seguindo o design system do projeto
- [ ] Rota registrada
- [ ] Link na navegação com visibilidade correta
- [ ] Testes rodando (se o projeto tiver suite de testes)
