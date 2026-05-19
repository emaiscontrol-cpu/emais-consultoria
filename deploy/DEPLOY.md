# Deploy — E Mais Consultoria
## www.emaiscontrol.com.br

---

## PRÉ-REQUISITOS (instalar no servidor antes)

| Software | Link | Versão mínima |
|----------|------|---------------|
| Python   | https://www.python.org/downloads/ | 3.11+ |
| Git      | https://git-scm.com/download/win  | qualquer |
| Node.js  | https://nodejs.org/                | 20+    |

> Marcar "Add to PATH" em todos durante a instalação.

---

## PASSO 1 — DNS

No painel do seu domínio, criar/editar o registro:

```
Tipo: A
Nome: www
Valor: [IP FIXO DO SERVIDOR]
TTL: 300
```

---

## PASSO 2 — Executar o script de instalação

No servidor, abrir o **PowerShell como Administrador** e rodar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
irm https://raw.githubusercontent.com/emaiscontrol-cpu/emais-consultoria/main/deploy/instalar.ps1 | iex
```

Ou, se já clonou o repositório:
```powershell
cd C:\emais-service\app\deploy
.\instalar.ps1
```

---

## PASSO 3 — Instalar o Caddy (proxy reverso + HTTPS)

1. Baixar o Caddy: https://caddyserver.com/download
   - Selecionar **Windows amd64** → baixar `caddy_windows_amd64.exe`
   - Renomear para `caddy.exe` e mover para `C:\caddy\`

2. Copiar o Caddyfile:
```powershell
Copy-Item C:\emais-service\app\deploy\Caddyfile C:\caddy\Caddyfile
```

3. Instalar o Caddy como serviço:
```powershell
cd C:\caddy
.\caddy.exe service install
.\caddy.exe service start
```

---

## PASSO 4 — Abrir o Firewall do Windows

```powershell
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=TCP localport=443
```

---

## PASSO 5 — Testar

Acessar no navegador: **https://www.emaiscontrol.com.br**

O HTTPS é configurado automaticamente pelo Caddy via Let's Encrypt.

---

## ATUALIZAR O SISTEMA (após mudanças no código)

```powershell
cd C:\emais-service\app
git pull
cd frontend && npm run build && cd ..
C:\emais-service\emais-backend.exe restart
```
