# Registro de Validação — chore/modernizacao-dependencias

Nesta fase de modernização de dependências, varredura de deprecações e logging estruturado, todas as metas foram concluídas com sucesso.

## Alterações Realizadas

1. **Substituição de dependências de segurança (Tarefas 1 & 2):**
   * Removido `python-jose` e adicionado `PyJWT>=2.8` em `requirements.txt`.
   * Removido `passlib` e atualizado `bcrypt` para `>=4.1` em `requirements.txt`.
   * No backend [auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/auth.py), as lógicas de encode, decode e verificação de assinatura do JWT foram migradas para o `PyJWT` capturando a exceção genérica `jwt.PyJWTError`.
   * A hash e a verificação de senhas foram portadas para o `bcrypt` direto usando `bcrypt.hashpw` e `bcrypt.checkpw` (com proteção try/except `ValueError` para hashes incorretos) e documentada a limitação de truncamento em 72 bytes.

2. **Varredura de Deprecações (Tarefa 3):**
   * Substituídas as chamadas legadas de `datetime.utcnow()` por `datetime.now(timezone.utc)` em [auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/auth.py) e [routers/auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/auth.py).
   * Modificado o parâmetro depreciado `regex` para `pattern` nas chamadas de `Query` em [fc_exec.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/fc_exec.py) (3 ocorrências).
   * Modificadas todas as buscas do padrão legado `db.query(Model).get(id)` para `db.get(Model, id)` em todos os routers contidos na pasta [routers/](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers).

3. **Logging Estruturado (Tarefa 4):**
   * Criado o módulo [logger.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/logger.py) usando `logging.basicConfig` e o formato padrão de logs do uvicorn, definindo o nível de log via variável de ambiente `LOG_LEVEL` (default `INFO`).
   * Logger inicializado e carregado no topo de [main.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/main.py).
   * Substituídos todos os prints do backend por chamadas de logger adequadas em `auth.py`, `main.py` e `routers/admin.py`.
   * Adicionada captura com `logger.exception` nos blocos `except Exception as e` em [routers/admin.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/admin.py) (rotas de backup, restauração e exclusão) e nos routers de IA ([gemini.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/gemini.py), [ia.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/ia.py) e [openrouter.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/openrouter.py)) para registrar o traceback detalhado.

4. **Lock de Dependências e CI/CD (Tarefa 5):**
   * Gerado o arquivo `backend/requirements.lock.txt` a partir das dependências limpas e atualizadas do venv de desenvolvimento.
   * Alterados os workflows `.github/workflows/deploy.yml` e `.github/workflows/ci.yml` para passarem a rodar a instalação do backend a partir de `requirements.lock.txt`.
   * Atualizado [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) documentando o processo e o fluxo de manutenção de pacotes (editar `requirements.txt` → regenerar lock).

---

## Validação Executada

### Testes Automatizados (CI)
* Criados e executados novos testes unitários em [tests/test_api.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_api.py):
  1. `test_me_token_expirado`: Valida se tokens expirados geram status HTTP 401.
  2. `test_me_token_assinatura_invalida`: Valida se assinaturas incorretas retornam status HTTP 401.
  3. `test_verificar_senha_legado_passlib`: Valida se o algoritmo do `bcrypt` consegue verificar um hash antigo no formato `$2b$` gerado pelo `passlib`.
* A suíte de testes de backend rodou com 100% de sucesso (**72/72 testes passando**).

### Build do Frontend
* O build do frontend rodou com sucesso (`npm run build`), gerando os bundles otimizados no diretório `frontend/dist`.

### Startup do Servidor Local
* O servidor `uvicorn` foi inicializado e executou com sucesso a inicialização das tabelas e o agendamento de backup, exibindo os novos logs estruturados no console no formato esperado.
