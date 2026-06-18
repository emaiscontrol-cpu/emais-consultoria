---
description: Executa o fluxo completo de release do E Mais Consultoria — build do frontend, atualização de versão, commit do dist e deploy via release.ps1
argument-hint: [versao] (ex: 2.5.1a)
allowed-tools: [Read, Edit, Bash, PowerShell, Glob]
---

# Release — E Mais Consultoria

Executa o fluxo completo de release. Argumento opcional: versão desejada — $ARGUMENTS

## Passo 1 — Confirmar branch e estado

```bash
git status
git branch
git log --oneline -5
```

- Confirmar que está na branch correta (geralmente `main` após merge do PR)
- Working tree deve estar limpo — se houver mudanças pendentes, perguntar ao usuário se quer commitar antes
- Se não estiver na `main`, alertar e perguntar se quer fazer o merge primeiro

## Passo 2 — Determinar a nova versão

Ler a versão atual em `backend/main.py`:

```bash
grep "app.version" backend/main.py
```

Padrão de incremento: `2.5.0s` → `2.5.0t` → ... → `2.5.0z` → `2.5.1a`

Se o usuário passou uma versão como argumento, usar essa. Caso contrário, sugerir o próximo incremento e confirmar.

## Passo 3 — Atualizar a versão no backend

Editar `backend/main.py`, linha com `app.version = "..."`:

```python
app.version = "<nova_versao>"
```

## Passo 4 — Build do frontend

```powershell
Set-Location frontend
npm run build
Set-Location ..
```

Verificar se `frontend/dist/index.html` foi atualizado (mtime recente). Se o build falhar, parar e reportar o erro — não prosseguir.

## Passo 5 — Commitar versão + dist

Verificar o que mudou:

```bash
git diff --stat
git status
```

Adicionar e commitar apenas os arquivos relevantes:

```bash
git add backend/main.py frontend/dist/
git commit -m "chore: release v<nova_versao>"
```

> ⚠️ Não usar `git add .` — pode incluir arquivos sensíveis ou gerados. Adicionar explicitamente.

## Passo 6 — Atualizar o ROADMAP.md

Abrir `ROADMAP.md` e:
- Mover os itens implementados de `## Em desenvolvimento` para `## ✅ Concluído` com a versão `(v<nova_versao>)`
- Perguntar ao usuário quais itens devem ser marcados como concluídos, se não estiver claro

Commitar o ROADMAP se houver mudanças:

```bash
git add ROADMAP.md
git commit -m "docs: atualiza ROADMAP para v<nova_versao>"
```

## Passo 7 — Push para main

```bash
git push origin main
```

## Passo 8 — Deploy via release.ps1

```powershell
.\release.ps1
```

O script:
- Faz `git push` (já feito no passo 7, mas o script pode fazer novamente — ok)
- O servidor puxa via git automaticamente
- O uvicorn recarrega em ~30s

## Passo 9 — Verificação pós-deploy

Aguardar ~30s e verificar:

```bash
curl -s https://earlobe-feeble-aground.ngrok-free.dev/api/version
```

Confirmar que `"version"` retorna `"<nova_versao>"`.

## Passo 10 — Lembrete ao usuário

Sempre encerrar com:

> ✅ Release v<nova_versao> publicado com sucesso.
> Pressione **Ctrl+Shift+R** no Electron para carregar a nova versão.
> Aguarde ~30s para o uvicorn recarregar no servidor.

---

## Checklist rápido

- [ ] Branch correta (main)
- [ ] Working tree limpo antes do build
- [ ] Versão atualizada em `backend/main.py`
- [ ] Build do frontend concluído sem erros
- [ ] `frontend/dist/` commitado
- [ ] ROADMAP atualizado
- [ ] Push enviado
- [ ] `release.ps1` executado
- [ ] `/api/version` confirmado no servidor
- [ ] Usuário avisado do Ctrl+Shift+R
