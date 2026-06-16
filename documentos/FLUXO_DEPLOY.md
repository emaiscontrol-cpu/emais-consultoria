# Fluxo de Deploy — E Mais Consultoria

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MÁQUINA LOCAL (Desenvolvimento)                     │
│                                                                             │
│  VS Code                                                                    │
│  ├── Terminal 1 (backend)                                                   │
│  │   cd backend → venv\Scripts\activate                                     │
│  │   python -m uvicorn main:app --reload --port 8001                        │
│  │                                                                          │
│  ├── Terminal 2 (frontend)                                                  │
│  │   cd frontend → npm run dev                                              │
│  │   http://localhost:5173  ──proxy──▶  localhost:8001                      │
│  │                                                                          │
│  └── Terminal 3 (release)                                                   │
│      .\release.ps1 patch                                                    │
│          │                                                                  │
│          ├── 1. Bump de versão em main.py e package.json                    │
│          ├── 2. npm run build  (gera frontend/dist)                         │
│          ├── 3. git add backend/ frontend/dist electron-client/package.json │
│          ├── 4. git commit -m "Release vX.X.X"                              │
│          └── 5. git push origin main                                        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ push
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB                                          │
│         github.com/emaiscontrol-cpu/emais-consultoria                        │
│                                                                              │
│   branch: main  ──on push──▶  Actions Workflow: deploy.yml                  │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ trigger
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        SERVIDOR (Produção via RDP)                           │
│                                                                              │
│  C:\actions-runner   ◀── self-hosted runner (executa deploy.yml)            │
│      │                                                                       │
│      ├── Step 1: git config safe.directory C:/emals-app                     │
│      ├── Step 2: cd C:\emals-app → git pull origin main                     │
│      └── Step 3: Restart-Service EmaisBackend                               │
│                          │                                                   │
│                          ▼                                                   │
│  C:\emals-app\backend                                                        │
│      uvicorn main:app --host 0.0.0.0 --port 8000                            │
│      Serviço Windows: EmaisBackend                                           │
│      (reinício automático configurado via sc.exe failure)                    │
│                          │                                                   │
│                          ▼                                                   │
│  C:\ngrok                                                                    │
│      ngrok http --domain=earlobe-feeble-aground.ngrok-free.dev 8000         │
│      Expõe: https://earlobe-feeble-aground.ngrok-free.dev                   │
│                                                                              │
│  C:\EmaisConsultoria                                                         │
│      emais-consultoria.exe  (Electron)                                       │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          USUÁRIOS FINAIS                                     │
│                                                                              │
│  .exe (Electron)          Navegador (colegas)                                │
│  └── conecta em           └── acessam                                       │
│      ngrok URL                ngrok URL                                      │
│                                                                              │
│  Detecção de versão:                                                         │
│  .exe verifica /api/version a cada 5 min                                     │
│  Se versão mudou → exibe banner "Nova versão disponível"                    │
│  Usuário clica "Atualizar agora" → location.reload()                        │
└──────────────────────────────────────────────────────────────────────────────┘


══════════════════════════════════════════════════════════
  PONTOS DE ATENÇÃO
══════════════════════════════════════════════════════════

  ⚠  Novos arquivos no backend (routers, models, etc):
     → git add <arquivo> ANTES de rodar .\release.ps1
     → release.ps1 usa "git add backend/" (pasta inteira)

  ⚠  Porta 8000 bloqueada localmente (WinError 10013):
     → Desenvolvimento local usa porta 8001
     → vite.config.js proxy → localhost:8001
     → Servidor de produção usa porta 8000 normalmente

  ⚠  Se o serviço cair no servidor:
     → Acessar via RDP
     → cd C:\emals-app; git pull origin main
     → Restart-Service EmaisBackend

  ⚠  Se o ngrok parar:
     → No servidor: ngrok http --domain=earlobe-feeble-aground.ngrok-free.dev 8000


══════════════════════════════════════════════════════════
  TIPOS DE RELEASE
══════════════════════════════════════════════════════════

  .\release.ps1 patch    → 2.0.0c → 2.0.0d   (ajuste/correção)
  .\release.ps1 beta     → 2.0.0d-beta        (deploy silencioso, sem notificar usuários)
  .\release.ps1 minor    → 2.0.0 → 2.1.0      (funcionalidade nova)
  .\release.ps1 major    → 2.1.0 → 3.0.0      (implementação robusta)

══════════════════════════════════════════════════════════
  Atualizado: Maio/2026
══════════════════════════════════════════════════════════
```
