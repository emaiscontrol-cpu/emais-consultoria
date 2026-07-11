# Plano de Modernização de Dependências, Varredura de Deprecações e Logs Estruturados — v2.6.3a

Este plano visa modernizar a segurança do backend removendo pacotes depreciados/abandonados (`python-jose` e `passlib`), resolvendo warnings de APIs antigas do SQLAlchemy e FastAPI (varredura de deprecações), implementando logging estruturado com a biblioteca padrão de Python para melhorar os registros de produção, e fixando as dependências do projeto através de arquivos de lock.

---

## Revisão Requerida pelo Usuário

> [!IMPORTANT]
> **Compatibilidade de Senhas (Bcrypt Legado do Passlib):**
> Os hashes de senha salvos no banco gerados pelo `passlib` usam o prefixo `$2b$`. Como o `bcrypt` nativo lê esse formato perfeitamente, os usuários existentes continuarão logando normalmente sem necessidade de redefinir senhas. Um teste unitário dedicado validará essa compatibilidade.
>
> **Risco de Deploy em Produção (Ponto de Atenção #9):**
> O script de deploy `.github/workflows/deploy.yml` será alterado para instalar as dependências a partir do arquivo de lock `requirements.lock.txt` em vez do `requirements.txt`. Garantiremos que a receita de deploy do GitHub Actions e o CI instalem este arquivo corretamente.

---

## Proposta de Alterações

### TAREFA 1 — Migração de `python-jose` para `PyJWT`
* **Dependências:**
  * Remover `python-jose[cryptography]==3.3.0` do `backend/requirements.txt`.
  * Adicionar `PyJWT>=2.8` em `backend/requirements.txt`.
* **Código em `backend/auth.py`:**
  * Substituir `from jose import JWTError, jwt` por `import jwt`.
  * Atualizar as chamadas para `jwt.encode` e `jwt.decode` (que funcionam de forma idêntica no PyJWT).
  * Capturar `jwt.PyJWTError` no lugar de `JWTError` no endpoint `/me`.
* **Testes em `tests/test_api.py`:**
  * Adicionar cenários para garantir que:
    1. Tokens expirados retornem HTTP 401.
    2. Tokens com assinaturas inválidas (assinados com outra chave secreta) retornem HTTP 401.

### TAREFA 2 — Substituição de `passlib` por `bcrypt` Nativo
* **Dependências:**
  * Remover `passlib==1.7.4` do `backend/requirements.txt`.
  * Ajustar `bcrypt` de `bcrypt==4.0.1` para `bcrypt>=4.1` em `backend/requirements.txt`.
* **Código em `backend/auth.py`:**
  * Substituir o objeto `pwd_context = CryptContext(...)` da `passlib`.
  * Reescrever `hash_senha(senha)` usando `bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')`.
  * Reescrever `verificar_senha(senha, hash)` usando `bcrypt.checkpw(senha.encode('utf-8'), hash.encode('utf-8'))` protegida por um bloco `try/except ValueError` para retornar `False` em caso de hashes malformados.
  * Adicionar documentação na docstring explicitando que o bcrypt trunca senhas com mais de 72 bytes.
* **Testes em `tests/test_api.py`:**
  * Adicionar o teste `test_verificar_senha_legado_passlib` para garantir a compatibilidade com hashes antigos gerados no formato `$2b$`.

### TAREFA 3 — Varredura de Deprecações
* **Timezone UTC em Datetime:**
  * Alterar `datetime.utcnow()` para `datetime.now(timezone.utc)` em [auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/auth.py) e [routers/auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/auth.py).
* **Regex no FastAPI Query:**
  * Substituir o parâmetro depreciado `regex=...` por `pattern=...` em [fc_exec.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/fc_exec.py) (3 ocorrências).
* **SQLAlchemy 2.0 query.get() deprecation:**
  * Reescrever todos os padrões de busca legados `db.query(Model).get(id)` para `db.get(Model, id)`. Os arquivos que sofrerão essas alterações mecânicas incluem:
    * `backend/routers/chat.py`
    * `backend/routers/clientes.py`
    * `backend/routers/fases.py`
    * `backend/routers/modelos.py`
    * `backend/routers/projetos.py`
    * `backend/routers/ref_benchmark.py`
    * `backend/routers/ref_demonstrativos.py`
    * `backend/routers/ref_depara.py`
    * `backend/routers/ref_plano.py`
    * `backend/routers/ref_segmentos.py`
    * `backend/routers/ref_templates.py`
    * `backend/routers/subtarefas.py`
    * `backend/routers/tarefas.py`
    * `backend/routers/usuarios.py`
    * `backend/routers/controladoria.py`

### TAREFA 4 — Logging Estruturado no Backend
* **Módulo de Logging:**
  * Criar [logger.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/logger.py) com a chamada `logging.basicConfig` configurando o formato `"%(asctime)s %(levelname)s %(name)s: %(message)s"` e nível parametrizado via `LOG_LEVEL` (padrão `INFO`).
  * Inicializar o logger no topo de `backend/main.py`.
* **Substituição de Prints:**
  * Mudar os comandos `print(...)` por `logger.info`, `logger.warning` ou `logger.error` em:
    * `backend/auth.py`
    * `backend/main.py`
    * `backend/routers/admin.py`
  * Capturas de erros em blocos `except` críticos (como em falhas de backup e conexões de IA) usarão `logger.exception` para salvar o traceback completo nos logs do uvicorn (emals-backend.err.log).

### TAREFA 5 — Lock de Dependências e Workflows
* **Dependências Fixas:**
  * Gerar o `backend/requirements.lock.txt` a partir de um venv limpo.
* **Workflows do GitHub:**
  * Alterar `.github/workflows/deploy.yml` para instalar a partir do lock: `run: .\venv\Scripts\pip.exe install -r requirements.lock.txt`.
  * Alterar `.github/workflows/ci.yml` para usar o cache apontando para `requirements.lock.txt` e instalar com `pip install -r requirements.lock.txt`.
* **Documentação:**
  * Adicionar ao [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) as instruções sobre o fluxo de atualização de pacotes: `"nova dependência = editar requirements.txt + regenerar lock"`.

---

## Plano de Validação

### Testes Automatizados
* Executar a suíte de testes unitários local com pytest:
  `.\backend\venv\Scripts\pytest.exe tests/ -p no:warnings`
* Garantir 100% verde e a aprovação das novas coberturas de autenticação.

### Validação Manual (Homologação Local)
* Subir o backend localmente e realizar um fluxo de login completo via interface Web ou Electron, certificando-se de que a validação de senhas antigas e novas e a geração de tokens estejam operando normalmente.
