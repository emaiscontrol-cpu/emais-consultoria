---
description: Executa o fluxo completo de release do E Mais Consultoria — build do frontend, atualização de versão, commit do dist, PR de release e deploy automático via deploy.yml
argument-hint: [versao] (ex: 2.5.1a)
allowed-tools: [Read, Edit, Bash, PowerShell, Glob]
---

# Release — E Mais Consultoria

Executa o fluxo completo de release. Argumento opcional: versão desejada — $ARGUMENTS

> ⚠️ **Branch protection ativa na `main`** — push direto é bloqueado. Todo release vai via branch `release/vX.Y.Za` + PR. O `deploy.yml` dispara automaticamente após o merge na `main`.

## Passo 0 — Conferência obrigatória

Execute a skill `/conferencia-pre-release`. Só prossiga com GO explícito. Com NO-GO, pare e reporte.

## Passo 1 — Partir da main atualizada

```bash
git checkout main && git pull
git status
```

Working tree deve estar limpo. Confirmar que todos os PRs de feature foram mergeados.

## Passo 2 — Determinar a nova versão

```bash
grep "app.version" backend/main.py
```

Padrão de incremento: `2.5.0s` → `2.5.0t` → ... → `2.5.0z` → `2.5.1a`

Se o usuário passou uma versão como argumento, usar essa. Caso contrário, sugerir o próximo incremento e confirmar.

## Passo 3 — Criar branch de release

```bash
git checkout -b release/v<nova_versao>
```

## Passo 4 — Atualizar versão em `backend/main.py`

```python
app.version = "<nova_versao>"
```

## Passo 5 — Build do frontend

```powershell
Set-Location frontend; npm run build; Set-Location ..
```

Se o build falhar, parar e reportar — não prosseguir.

## Passo 6 — Atualizar ROADMAP_2.md

- Atualizar `> Última atualização:` para a data de hoje
- Mover itens implementados para `## ✅ CONCLUÍDO` com a versão, se houver pendentes

## Passo 7 — Commitar

```bash
git add backend/main.py frontend/dist/ ROADMAP_2.md
git commit -m "chore: release v<nova_versao>"
```

> ⚠️ Não usar `git add .` — adicionar explicitamente para evitar arquivos sensíveis.

## Passo 8 — Push e PR

```bash
git push -u origin release/v<nova_versao>
```

Abrir PR usando `gh` (disponível em `C:\Program Files\GitHub CLI\gh.exe`):

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr create `
  --base main --head release/v<nova_versao> `
  --title "chore: release v<nova_versao>" `
  --body "Bump de versão e build do frontend.`n`n- [ ] CI verde`n- [ ] /api/version retorna <nova_versao> após deploy"
```

## Passo 9 — Aguardar CI e mergear

```powershell
# Verificar checks
& "C:\Program Files\GitHub CLI\gh.exe" pr checks <numero_do_pr>

# Após CI verde:
& "C:\Program Files\GitHub CLI\gh.exe" pr merge <numero_do_pr> --merge --delete-branch
```

O `deploy.yml` (self-hosted) dispara automaticamente no push para `main` e faz o deploy no servidor.

## Passo 10 — Verificar no servidor

Aguardar ~30s e verificar:

```bash
curl -s https://earlobe-feeble-aground.ngrok-free.dev/api/version
```

Confirmar que `"version"` retorna `"<nova_versao>"`.

## Passo 11 — Lembrete ao usuário

> ✅ Release v<nova_versao> publicado com sucesso.
> Pressione **Ctrl+Shift+R** no Electron para carregar a nova versão.
> Aguarde ~30s para o uvicorn recarregar no servidor.

---

## Checklist rápido

- [ ] `main` atualizada e limpa antes de iniciar
- [ ] Branch `release/v<nova_versao>` criada a partir da `main`
- [ ] Versão atualizada em `backend/main.py`
- [ ] Build do frontend sem erros
- [ ] `backend/main.py` + `frontend/dist/` + `ROADMAP_2.md` commitados
- [ ] PR aberto e CI verde
- [ ] PR mergeado (deploy.yml dispara automaticamente)
- [ ] `/api/version` confirmado no servidor
- [ ] Usuário avisado do Ctrl+Shift+R
