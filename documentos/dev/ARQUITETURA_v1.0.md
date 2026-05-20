# Arquitetura Técnica — E Mais Consultoria
## Versão 1.0 | Maio 2026

---

## 1. Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                      MÁQUINA LOCAL (Windows 11)                  │
│                                                                   │
│   ┌────────────────────────────────────────────────────────┐    │
│   │              Windows Service (WinSW)                    │    │
│   │  C:\emals-service\emals-backend.exe                    │    │
│   │                                                         │    │
│   │   ┌─────────────────────────────────────────────┐      │    │
│   │   │         FastAPI + Uvicorn                    │      │    │
│   │   │         Python  •  Porta 8000                │      │    │
│   │   │                                              │      │    │
│   │   │  ┌─────────────┐   ┌──────────────────┐    │      │    │
│   │   │  │  API REST   │   │  Arquivos Estáticos│   │      │    │
│   │   │  │  /api/...   │   │  frontend/dist/   │   │      │    │
│   │   │  └──────┬──────┘   └──────────────────┘    │      │    │
│   │   │         │                                    │      │    │
│   │   │  ┌──────▼──────┐                            │      │    │
│   │   │  │ SQLAlchemy  │                            │      │    │
│   │   │  │    ORM      │                            │      │    │
│   │   │  └──────┬──────┘                            │      │    │
│   │   │         │                                    │      │    │
│   │   │  ┌──────▼──────┐                            │      │    │
│   │   │  │   SQLite    │                            │      │    │
│   │   │  │ emais_      │                            │      │    │
│   │   │  │ consultoria │                            │      │    │
│   │   │  │    .db      │                            │      │    │
│   │   │  └─────────────┘                            │      │    │
│   │   └─────────────────────────────────────────────┘      │    │
│   └────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                         Porta 8000                               │
│                              │                                    │
│   ┌──────────────────────────▼───────────────────────────┐      │
│   │                      ngrok                            │      │
│   │   Túnel seguro HTTPS → URL pública temporária         │      │
│   │   https://xxxx-xxx-xxx.ngrok-free.app                 │      │
│   └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
         │ localhost:8000          │ URL pública ngrok
         ▼                        ▼
   Usuário local           Usuários remotos
   (navegador)             (qualquer lugar)
```

---

## 2. Stack Tecnológica

| Camada            | Tecnologia              | Versão      |
|-------------------|-------------------------|-------------|
| Linguagem backend | Python                  | 3.x         |
| Framework API     | FastAPI                 | ≥ 0.111.0   |
| Servidor ASGI     | Uvicorn                 | ≥ 0.29.0    |
| ORM               | SQLAlchemy              | ≥ 2.0.30    |
| Banco de dados    | SQLite                  | (nativo)    |
| Autenticação      | JWT (python-jose)       | 3.3.0       |
| Hash de senha     | bcrypt (passlib)        | 4.0.1       |
| Relatórios Excel  | openpyxl                | ≥ 3.1.0     |
| Framework front   | React                   | 19.x        |
| Bundler           | Vite                    | 8.x         |
| Roteamento SPA    | React Router DOM        | 7.x         |
| HTTP client       | Axios                   | —           |
| Serviço Windows   | WinSW                   | —           |
| Túnel remoto      | ngrok                   | free tier   |
| Controle de versão| Git + GitHub            | —           |

---

## 3. Estrutura de Diretórios

```
emals_consultoria/                  ← Raiz do projeto (OneDrive)
│
├── backend/                        ← Código Python
│   ├── main.py                     ← Ponto de entrada FastAPI
│   ├── database.py                 ← Conexão SQLAlchemy + SQLite
│   ├── models.py                   ← Modelos ORM (tabelas)
│   ├── schemas.py                  ← Schemas Pydantic (validação)
│   ├── auth.py                     ← Lógica JWT (gerar/validar token)
│   ├── helpers.py                  ← Funções auxiliares
│   ├── seed.py                     ← Script de dados iniciais
│   ├── requirements.txt            ← Dependências Python
│   ├── .env                        ← SECRET_KEY (não comitar segredos!)
│   ├── venv/                       ← Ambiente virtual Python (ignorado Git)
│   └── routers/                    ← Um arquivo por entidade
│       ├── auth.py                 ← POST /api/auth/login, /me, /senha
│       ├── usuarios.py             ← CRUD de usuários
│       ├── clientes.py             ← CRUD de clientes
│       ├── projetos.py             ← CRUD de projetos
│       ├── fases.py                ← CRUD de fases + comentários
│       ├── tarefas.py              ← CRUD de tarefas + responsáveis
│       ├── subtarefas.py           ← CRUD de subtarefas
│       ├── dashboard.py            ← Resumo e KPIs
│       ├── notificacoes.py         ← Alertas + exportação Excel
│       ├── relatorios.py           ← Excel de projetos + gráficos
│       └── historico.py            ← Log de atividades
│
├── frontend/                       ← Código React
│   ├── src/
│   │   ├── main.jsx                ← Ponto de entrada React
│   │   ├── App.jsx                 ← Rotas SPA + layout protegido
│   │   ├── index.css               ← Design system (variáveis CSS)
│   │   ├── assets/
│   │   │   └── logo.png            ← Logo da empresa
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx     ← Estado global de autenticação
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         ← Menu lateral
│   │   │   └── shared/             ← Componentes reutilizáveis
│   │   ├── pages/                  ← Uma página por rota
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projetos.jsx
│   │   │   ├── ProjetoDetalhe.jsx
│   │   │   ├── Clientes.jsx
│   │   │   ├── Usuarios.jsx
│   │   │   ├── Notificacoes.jsx
│   │   │   ├── Relatorios.jsx
│   │   │   ├── HistoricoAtividades.jsx
│   │   │   └── Manual.jsx
│   │   └── services/
│   │       └── api.js              ← Todas as chamadas Axios à API
│   ├── dist/                       ← Build compilado (ignorado Git)
│   ├── package.json
│   └── vite.config.js
│
├── deploy/                         ← Scripts para servidor de produção
│   ├── instalar.ps1                ← Script PowerShell de instalação
│   ├── emais-backend-servidor.xml  ← Config WinSW para servidor
│   ├── Caddyfile                   ← Config proxy reverso (HTTPS)
│   └── DEPLOY.md                   ← Passo a passo do deploy
│
├── documentos/
│   ├── MANUAL_OPERACIONAL.md       ← Manual do usuário final (v1.0)
│   └── dev/
│       └── ARQUITETURA_v1.0.md     ← Este documento
│
├── .gitignore                      ← Exclusões do Git
├── COMO_EXECUTAR.md                ← Instruções básicas de execução
└── C:\emals-service\               ← Fora do OneDrive (evitar conflito de sync)
    ├── emals-backend.exe           ← WinSW executável do serviço
    ├── emals-backend.xml           ← Configuração do serviço Windows
    ├── emais_consultoria.db        ← Banco de dados SQLite (DADOS REAIS)
    ├── abrir-porta-8000.bat        ← Script para liberar firewall
    └── logs/                       ← Logs do serviço (stdout/stderr)
```

---

## 4. Fluxo de Requisição (Request Flow)

```
USUÁRIO (Navegador)
       │
       │  1. Acessa http://localhost:8000  (ou URL ngrok)
       ▼
   FastAPI / Uvicorn
       │
       ├── Rota /api/* ?
       │       │
       │       │  SIM → Valida JWT no header Authorization: Bearer <token>
       │       │         └── Router correspondente → SQLAlchemy → SQLite → JSON response
       │       │
       │       └── NÃO → Serve frontend/dist/index.html (SPA React)
       │
       ▼
   React (SPA no navegador)
       │
       ├── AuthContext verifica token salvo no localStorage
       │       ├── Token válido → renderiza página protegida
       │       └── Sem token   → redireciona para /login
       │
       └── Chamadas Axios para /api/* com header:
               ├── Authorization: Bearer <JWT>
               └── ngrok-skip-browser-warning: 1  (bypass ngrok interstitial)
```

---

## 5. Autenticação JWT

```
LOGIN
  POST /api/auth/login  { email, senha }
       │
       ├── Verifica email no banco
       ├── bcrypt.verify(senha, hash_armazenado)
       └── Gera JWT com payload: { sub: email, exp: +24h }
              │
              └── Retorna { access_token, usuario: { nome, perfil, ... } }

REQUISIÇÕES AUTENTICADAS
  Header: Authorization: Bearer <JWT>
       │
       └── FastAPI: Depends(get_current_user)
               ├── Decodifica JWT com SECRET_KEY
               └── Retorna objeto usuário ou HTTP 401

PERFIS DE ACESSO
  admin       → acesso total (usuários, relatórios, histórico, etc.)
  consultor   → projetos, clientes, relatórios, histórico
  ger_projeto → projetos, clientes, relatórios, histórico
  cliente     → apenas projetos e notificações vinculados a ele
```

---

## 6. Banco de Dados — Modelo de Entidades

```
usuarios
  id | nome | email | senha_hash | perfil | ativo | criado_em

clientes
  id | nome | cnpj | contato | email | telefone | criado_em

projetos
  id | nome | descricao | status | cliente_id | criado_em | atualizado_em

fases
  id | nome | descricao | status | ordem | projeto_id | bloqueado_por_anterior

tarefas
  id | titulo | descricao | status | prioridade | prazo | fase_id | ativo

subtarefas
  id | titulo | concluida | tarefa_id

tarefa_responsaveis
  id | tarefa_id | usuario_id

comentarios_fase
  id | fase_id | usuario_id | texto | criado_em

comentarios_tarefa
  id | tarefa_id | usuario_id | texto | criado_em

historico
  id | usuario_id | acao | entidade | entidade_id | detalhes | criado_em
```

---

## 7. Serviço Windows (WinSW)

O backend roda como **serviço do Windows** para iniciar automaticamente com o sistema.

**Localização:** `C:\emals-service\`

**Arquivo de configuração** (`emals-backend.xml`):
```xml
<service>
  <id>EmaisBackend</id>
  <name>Emais Backend</name>
  <executable>python</executable>
  <arguments>-m uvicorn main:app --host 0.0.0.0 --port 8000</arguments>
  <workingdirectory>...\backend</workingdirectory>
  <logpath>C:\emals-service\logs</logpath>
</service>
```

**Comandos de gerenciamento** (PowerShell em `C:\emals-service\`):

```powershell
.\emals-backend.exe install    # Instala o serviço
.\emals-backend.exe start      # Inicia
.\emals-backend.exe stop       # Para
.\emals-backend.exe restart    # Reinicia
.\emals-backend.exe uninstall  # Remove o serviço
```

**Verificar status:**
```powershell
Get-Service EmaisBackend
```

**Ver logs em tempo real:**
```powershell
Get-Content "C:\emals-service\logs\emals-backend.out.log" -Wait -Tail 50
```

---

## 8. Build do Frontend

O React precisa ser **compilado** antes de ser servido pelo FastAPI.

```
frontend/src/   →  [npm run build]  →  frontend/dist/
(código fonte)                         (arquivos estáticos prontos)
```

**Comandos:**
```bash
cd frontend
npm install          # Instalar dependências (apenas 1ª vez)
npm run build        # Compilar para produção → gera dist/
npm run dev          # Servidor de desenvolvimento (porta 5173)
```

**A pasta `dist/` é ignorada pelo Git.** Sempre que o código frontend for alterado, é preciso rodar `npm run build` e reiniciar o serviço Windows para o backend servir a versão atualizada.

---

## 9. ngrok — Acesso Remoto

O ngrok cria um **túnel HTTPS** da porta local 8000 para uma URL pública temporária.

```
Internet → https://xxxx-xxx.ngrok-free.app → localhost:8000
```

**Iniciar túnel:**
```bash
ngrok http 8000
```

**Importante:**
- A URL muda a cada vez que o ngrok é reiniciado (plano gratuito)
- O ngrok precisa estar rodando para colegas acessarem remotamente
- Se o computador for desligado ou o ngrok fechado, o acesso remoto cai
- O header `ngrok-skip-browser-warning: 1` está configurado no Axios para evitar a tela de aviso do ngrok nas chamadas de API

**Para acesso permanente sem URL variável:** migrar para o servidor de produção com domínio fixo (`www.emaiscontrol.com.br`).

---

## 10. GitHub — Controle de Versão

**Repositório:** `https://github.com/emaiscontrol-cpu/emais-consultoria`  
**Conta GitHub:** login via Google (`emais.consultoria@gmail.com`)  
**Branch principal:** `main`

**Fluxo de trabalho:**
```bash
git status                          # Ver arquivos modificados
git add <arquivo>                   # Preparar arquivo para commit
git commit -m "Descrição da mudança"
git push origin main                # Enviar para GitHub
git log --oneline                   # Histórico de versões
```

**Para restaurar uma versão anterior:**
```bash
git log --oneline                   # Copiar o hash da versão desejada
git checkout <hash> -- <arquivo>    # Restaurar arquivo específico
# ou
git reset --hard <hash>             # Voltar tudo para aquela versão (cuidado!)
```

**O que NÃO é versionado** (`.gitignore`):
```
backend/venv/           ← ambiente virtual Python
backend/*.db            ← banco de dados local
frontend/node_modules/  ← dependências JS
frontend/dist/          ← build compilado
backend/.env            ← chave secreta JWT
.claude/                ← configurações do assistente
```

---

## 11. Portas e Endpoints

| Porta | Serviço         | Acesso              |
|-------|-----------------|---------------------|
| 8000  | FastAPI/Uvicorn | localhost + ngrok   |
| 5173  | Vite dev server | apenas desenvolvimento local |

**Endpoints principais da API:**

```
POST   /api/auth/login              ← Login (retorna JWT)
GET    /api/auth/me                 ← Dados do usuário logado
PUT    /api/auth/senha              ← Alterar senha

GET    /api/dashboard/resumo        ← KPIs gerais
GET    /api/dashboard/projetos-resumo

GET    /api/clientes/               ← Listar clientes
POST   /api/clientes/               ← Criar cliente

GET    /api/projetos/               ← Listar projetos
POST   /api/projetos/               ← Criar projeto
GET    /api/projetos/{id}           ← Detalhe
PUT    /api/projetos/{id}           ← Editar
DELETE /api/projetos/{id}           ← Deletar

GET    /api/fases/projeto/{id}      ← Fases de um projeto
POST   /api/fases/                  ← Criar fase

GET    /api/tarefas/fase/{id}       ← Tarefas de uma fase
POST   /api/tarefas/                ← Criar tarefa

GET    /api/subtarefas/tarefa/{id}  ← Subtarefas de uma tarefa
POST   /api/subtarefas/             ← Criar subtarefa

GET    /api/usuarios/               ← Listar usuários (admin)
POST   /api/usuarios/               ← Criar usuário (admin)

GET    /api/notificacoes/           ← Alertas de prazos
GET    /api/notificacoes/excel      ← Exportar alertas Excel

GET    /api/relatorios/projetos/excel       ← Exportar projetos Excel
GET    /api/relatorios/graficos/{id}        ← Dados gráficos do projeto

GET    /api/historico/              ← Log de atividades
```

**Documentação automática da API (FastAPI):**
```
http://localhost:8000/docs     ← Swagger UI (interativo)
http://localhost:8000/redoc    ← ReDoc
```

---

## 12. Variáveis de Ambiente

**Arquivo:** `backend/.env`

```env
SECRET_KEY=emais-consultoria-secret-2026-change-in-production
```

> ⚠️ Em produção, substituir por uma chave longa e aleatória.  
> Gerar com: `python -c "import secrets; print(secrets.token_hex(32))"`

---

## 13. Resumo dos Terminais Necessários

| Terminal | Onde abrir            | Comando                        | Quando usar                   |
|----------|-----------------------|--------------------------------|-------------------------------|
| Serviço  | `C:\emals-service\`   | `.\emals-backend.exe restart`  | Após alterar código backend   |
| Build    | `projeto\frontend\`   | `npm run build`                | Após alterar código frontend  |
| ngrok    | Qualquer lugar        | `ngrok http 8000`              | Para liberar acesso remoto    |
| Git      | Raiz do projeto       | `git add`, `commit`, `push`    | Para salvar versão no GitHub  |

---

## 14. Histórico de Versões

| Versão | Data       | Descrição                                              |
|--------|------------|--------------------------------------------------------|
| 1.0    | Maio 2026  | Sistema completo: autenticação, projetos, fases, tarefas, subtarefas, clientes, usuários, dashboard, relatórios, histórico, notificações, manual operacional, identidade visual E Mais |

---

*Documento técnico interno — E Mais Consultoria | Desenvolvedor/Administrador*
