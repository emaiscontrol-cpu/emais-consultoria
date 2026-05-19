# E Mais Consultoria — Guia de Instalação e Execução

## Pré-requisitos
- Python 3.11 ou superior → https://www.python.org/downloads/
- VS Code → https://code.visualstudio.com/
- Node.js 20+ (para o frontend, depois) → https://nodejs.org/

---

## PASSO 1 — Abrir o projeto no VS Code

1. Abra o VS Code
2. Menu: **File → Open Folder**
3. Selecione a pasta `emals_consultoria`

---

## PASSO 2 — Abrir o terminal integrado

No VS Code: **Terminal → New Terminal** (ou Ctrl + `)

---

## PASSO 3 — Criar e ativar ambiente virtual (venv)

No terminal, navegue até a pasta backend:

```bash
cd backend
```

Criar o ambiente virtual:

```bash
python -m venv venv
```

Ativar o ambiente virtual:

- **Windows:**
  ```bash
  venv\Scripts\activate
  ```
- **Mac / Linux:**
  ```bash
  source venv/bin/activate
  ```

Você saberá que funcionou quando aparecer `(venv)` no início da linha do terminal.

---

## PASSO 4 — Instalar as dependências

```bash
pip install -r requirements.txt
```

Aguarde a instalação (pode demorar 1-2 minutos na primeira vez).

---

## PASSO 5 — Popular o banco com dados iniciais

```bash
python seed.py
```

Você verá:
```
✅ Banco populado com sucesso!

Usuários criados:
  admin@emals.com.br       → senha: admin123      (Administrador)
  consultor@emals.com.br   → senha: consultor123  (Consultor)
  joao@redeforte.com.br    → senha: cliente123    (Cliente — Rede Forte)
```

---

## PASSO 6 — Iniciar o servidor

```bash
uvicorn main:app --reload
```

O servidor estará rodando em: **http://localhost:8000**

A flag `--reload` faz o servidor reiniciar automaticamente quando você salvar um arquivo.

---

## PASSO 7 — Testar a API (Documentação automática)

Abra no navegador:
- **http://localhost:8000/docs** → Interface interativa (Swagger UI)
- **http://localhost:8000/redoc** → Documentação alternativa

Na interface Swagger, você pode testar todos os endpoints diretamente!

---

## Estrutura de arquivos

```
emals_consultoria/
├── backend/
│   ├── main.py          ← Aplicação principal FastAPI
│   ├── database.py      ← Configuração do banco SQLite
│   ├── models.py        ← Tabelas do banco (SQLAlchemy)
│   ├── schemas.py       ← Validação de dados (Pydantic)
│   ├── auth.py          ← Autenticação JWT
│   ├── seed.py          ← Dados iniciais de exemplo
│   ├── requirements.txt ← Dependências Python
│   └── routers/
│       ├── auth.py       ← Login / Autenticação
│       ├── usuarios.py   ← Gestão de usuários
│       ├── clientes.py   ← Gestão de clientes
│       ├── projetos.py   ← Gestão de projetos
│       ├── fases.py      ← Fases sequenciais
│       ├── tarefas.py    ← Tarefas + fluxo de validação
│       └── dashboard.py  ← Resumos e métricas
└── COMO_EXECUTAR.md     ← Este arquivo
```

---

## Extensão recomendada no VS Code

Instale a extensão **Python** da Microsoft:
1. Clique no ícone de extensões (Ctrl+Shift+X)
2. Busque: `Python`
3. Instale a da Microsoft (ms-python.python)

---

## Solução de problemas comuns

**Erro: "python não reconhecido"**
→ Python não está no PATH. Reinstale marcando "Add Python to PATH"

**Erro: "pip não reconhecido"**
→ Use `python -m pip install -r requirements.txt`

**Porta 8000 em uso**
→ Rode em outra porta: `uvicorn main:app --reload --port 8001`

**Erro de importação no seed.py**
→ Certifique-se de estar dentro da pasta `backend` antes de rodar

---

## Próximo passo: Frontend React

O frontend será desenvolvido em React com Vite e se conectará
automaticamente a esta API. Instruções na próxima etapa.
