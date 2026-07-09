# Plano de Higiene de Código, Organização e Docs — v2.6.2t

Este plano visa realizar tarefas de higiene profunda no codebase do backend, remover códigos inativos e perigosos, resolver conflitos latentes de caminhos de pacotes, normalizar o encoding de caracteres do backend (mojibake) e sincronizar a documentação do projeto com o estado real do código.

---

## 1. Proposta de Alterações

### TAREFA 1 — Remoção de Código Morto Perigoso em `xlsx_parser.py`
* **Deletar:** A função `_val(cell)` em [xlsx_parser.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/xlsx_parser.py) que converte valores monetários com lógica incorreta e silenciosa.
* **Testes unitários:** Criar o arquivo [test_xlsx_parser.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_xlsx_parser.py) e implementar testes para a função correta `_limpar_val`, garantindo cobertura dos seguintes cenários:
  * `"1234,56"` -> `1234.56`
  * `"1.234,56"` -> `1234.56`
  * `"R$ 1.234,56"` -> `1234.56`
  * `"-1.234,56"` -> `-1234.56`
  * `"12.345.678,90"` -> `12345678.90`
  * `None` -> `0.0`
  * `""` -> `0.0`

### TAREFA 2 — Resolução de Colisão do Módulo `auth.py`
* **Renomear:** `backend/auth.py` para `backend/security.py`.
* **Atualizar Imports:** Substituir todas as referências de importação do módulo `auth` no backend e na suíte de testes:
  * Alterar `from auth import ...` para `from security import ...`.
  * Alterar `import auth` para `import security` (quando referenciar o backend/auth.py original).
  * Manter `from routers import auth` intacto em [main.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/main.py) (pois é o router `/api/auth`).
  * Atualizar o [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) (seção Estrutura de Arquivos).

### TAREFA 3 — Correção de Mojibake em `backend/main.py` e `.gitattributes`
* **Limpar Mojibake:** Reescrever todas as strings com caracteres corrompidos em `backend/main.py` (títulos, descrições, tags do swagger e comentários).
* **Remover BOM:** Salvar o arquivo `backend/main.py` codificado estritamente em UTF-8 sem BOM (Byte Order Mark).
* **Configurar `.gitattributes`:** Criar o arquivo [.gitattributes](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/.gitattributes) na raiz com as regras:
  ```gitattributes
  text=auto
  *.py text eol=lf working-tree-encoding=UTF-8
  *.jsx text eol=lf
  *.js text eol=lf
  *.md text eol=lf
  *.ps1 text eol=crlf
  ```
* **Normalizar EOL:** Executar `git add --renormalize .` e comitar isoladamente em `chore: normaliza fim de linha` para evitar ruído de CRLF/OneDrive nos diffs futuros.

### TAREFA 4 — Sincronizar CLAUDE.md e Versionamento
* **Documentação de Orçamento:** Corrigir a descrição do router `orcamento.py` em [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) para refletir que ele está ATIVO e funcional (com 622 linhas ativas: `/editavel`, `/sugerir-ia`, etc.).
* **Ajustar Roadmap:** Alterar a referência do ROADMAP na seção `## ROADMAP` do [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) de `ROADMAP.md` (deletado) para `ROADMAP_2.md`.
* **Histórico de Sessões:** Reordenar a Sessão 15 do histórico de sessões em [CLAUDE.md](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/CLAUDE.md) para ficar na sequência cronológica correta (entre a 16 e a 14).
* **Controle Único de Versão:**
  * Declarar a constante `APP_VERSION = "2.6.2s"` no topo de [main.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/main.py).
  * Usar a constante no construtor `app = FastAPI(..., version=APP_VERSION)` e na atribuição `app.version = APP_VERSION`.
  * Ajustar a leitura/escrita de versão no [release.ps1](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/release.ps1) para ler de `APP_VERSION` usando regex.

### TAREFA 5 — Guard nos scripts de Seed
* Adicionar uma checagem no início dos seguintes scripts de seed:
  * `backend/seed.py`
  * `backend/seed_controladoria.py`
  * `backend/seed_local_leal.py`
  * `backend/seed_ref_plano.py`
* A checagem importará `_is_sqlite` de `database` e se não for SQLite (`not _is_sqlite(db)`), finalizará a execução (`sys.exit`) com a mensagem: `"seed só roda em banco local SQLite"`.

---

## 2. Plano de Validação

### Testes Automatizados
* Executar pytest para certificar que o backend inteiro funciona sem erros circulares de importação:
  `.\backend\venv\Scripts\pytest.exe tests/ -p no:warnings`
* Verificar que o novo arquivo de testes `tests/test_xlsx_parser.py` roda com sucesso.

### Validação Manual (Build)
* Rodar o build de produção do frontend na pasta `frontend/`:
  `npm run build`
