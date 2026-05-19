# ECO | Sistema de Gestão — Documentação Completa

Este documento descreve todo o processo de configuração, publicação e gestão
do sistema **ECO** protegido por login, acessível pela internet via Firebase.

---

## Visão Geral da Solução

| Componente | Tecnologia | Descrição |
|---|---|---|
| Módulo 1 | `index.html` | Fluxo de Caixa 2026 |
| Módulo 2 | `orcamento.html` | Orçamento Integrado 2026 |
| Autenticação | Firebase Authentication | Login com e-mail e senha |
| Permissões | Firebase Firestore | Controle de acesso por módulo |
| Hospedagem | Firebase Hosting | URL pública |
| Gráficos | Chart.js 4.4.3 | Linha e barras comparativas |
| Sessão | Session Storage | Expira ao fechar o navegador |

**URLs do sistema:**
- Fluxo de Caixa: `https://fluxo-de-caixa-90548.web.app`
- Orçamento: `https://fluxo-de-caixa-90548.web.app/orcamento.html`

**Pasta local do deploy:** `C:\Users\luiz\Documents\eco-deploy\`

---

## PARTE 1 — Firebase Authentication (Login)

### 1.1 Configuração inicial

1. Acesse https://console.firebase.google.com
2. Projeto: **Fluxo de Caixa** (`fluxo-de-caixa-90548`)
3. Menu lateral → **Build → Authentication → Sign-in method**
4. Ative **E-mail/senha**

### 1.2 Gerenciar usuários

Acesse: Firebase Console → **Authentication → Users**

| Ação | Como fazer |
|---|---|
| Adicionar usuário | Botão **Adicionar usuário** → e-mail + senha |
| Remover acesso | 3 pontos → **Excluir usuário** |
| Bloquear temporariamente | 3 pontos → **Desativar usuário** |
| Redefinir senha | 3 pontos → **Redefinir senha** |

### 1.3 Comportamento da sessão

| Situação | Comportamento |
|---|---|
| Primeiro acesso | Exige login |
| Recarregar página (F5) | Mantém logado |
| Fechar e reabrir o navegador | Exige login novamente |
| Clicar em Sair | Exige login novamente |
| Navegar entre módulos | Mantém logado (mesma sessão) |

---

## PARTE 2 — Firebase Firestore (Controle de Permissões)

O Firestore controla quais módulos cada usuário pode acessar.

### 2.1 Estrutura do banco de dados

```
Coleção: usuarios
└── Documento (ID automático)
    ├── email: "usuario@email.com"   (string)
    └── modulos: ["fluxo-caixa", "orcamento"]   (array)
```

### 2.2 Valores válidos para o campo `modulos`

| Valor | Módulo liberado |
|---|---|
| `fluxo-caixa` | Fluxo de Caixa (`index.html`) |
| `orcamento` | Orçamento (`orcamento.html`) |

**Exemplos de configuração:**

| modulos | Acesso |
|---|---|
| `["fluxo-caixa", "orcamento"]` | Acessa os dois módulos |
| `["fluxo-caixa"]` | Só Fluxo de Caixa |
| `["orcamento"]` | Só Orçamento |
| `[]` (vazio) | Tela de Acesso Não Autorizado |

### 2.3 Como adicionar um novo usuário com permissões

**Passo 1 — Criar o login** (Firebase Authentication):
1. Authentication → Users → **Adicionar usuário**
2. Informar e-mail e senha

**Passo 2 — Definir permissões** (Firebase Firestore):
1. Firestore → **Dados** → coleção `usuarios`
2. Clique em **+ Adicionar documento**
3. ID do documento: clique em **ID automático**
4. Adicione os campos:
   - `email` (string) → e-mail do usuário
   - `modulos` (array) → valores: `fluxo-caixa` e/ou `orcamento`
5. Clique em **Salvar**

### 2.4 Como alterar permissões de um usuário existente

1. Firestore → **Dados** → coleção `usuarios`
2. Clique no documento do usuário
3. Clique no campo `modulos` para editar
4. Adicione ou remova os valores do array
5. Clique em **Atualizar**

### 2.5 Regras de segurança do Firestore

Acesse: Firestore → aba **Regras**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{docId} {
      allow read: if request.auth != null
                  && resource.data.email == request.auth.token.email;
    }
  }
}
```

> Cada usuário lê apenas o próprio documento. Ninguém acessa dados de outro usuário.

---

## PARTE 3 — Firebase Hosting (Publicação)

### 3.1 Instalar ferramentas (feito uma única vez)

```powershell
# Instalar Node.js: https://nodejs.org (versão LTS)

# Instalar Firebase CLI
npm install -g firebase-tools

# Login no Firebase
firebase login
```

Durante o `firebase login`, responda:
- Enable Gemini in Firebase features? → `n`
- Allow Firebase to collect CLI usage? → `n`
- Depois autorize no navegador

### 3.2 Estrutura da pasta de deploy

```
C:\Users\luiz\Documents\eco-deploy\
├── index.html        ← Fluxo de Caixa
└── orcamento.html    ← Orçamento
```

### 3.3 Publicar / atualizar o sistema

**Sempre que alterar qualquer arquivo:**

1. Copie o arquivo atualizado para a pasta de deploy:

```powershell
# Atualizar Fluxo de Caixa
Copy-Item "C:\Users\luiz\OneDrive\Anexos\Administrador\Documentos\Projetos\Fluxo de Caixa\ECO - FLUXO DE CAIXA.html" -Destination "C:\Users\luiz\Documents\eco-deploy\index.html"
```

2. Faça o deploy:

```powershell
cd "C:\Users\luiz\Documents\eco-deploy"; firebase deploy
```

---

## PARTE 4 — Estrutura dos Módulos

### Módulos disponíveis

| Módulo | Arquivo | URL |
|---|---|---|
| Fluxo de Caixa | `index.html` | `https://fluxo-de-caixa-90548.web.app` |
| Orçamento | `orcamento.html` | `https://fluxo-de-caixa-90548.web.app/orcamento.html` |

### Navegação entre módulos

Cada módulo tem uma barra de navegação no topo com botões para os outros módulos.
Os botões aparecem apenas para módulos que o usuário tem permissão de acessar.

### Comportamento de acesso

- **Usuário com permissão**: módulo abre normalmente
- **Usuário sem permissão**: tela de "Acesso Não Autorizado" com botão Sair
- **Usuário não logado**: tela de login

---

## PARTE 5 — Domínio Personalizado (Opcional)

Para usar seu próprio domínio (ex: `dashboard.seusite.com.br`):

1. Firebase Console → **Hosting → Adicionar domínio personalizado**
2. Digite o subdomínio desejado
3. Firebase gera registros DNS
4. Configure esses registros no painel do seu provedor de domínio
5. Em até 24h o domínio está ativo com HTTPS automático

> O sistema continua hospedado no Firebase — só o endereço muda.

---

## PARTE 6 — Referência Rápida

### Links do projeto

| Recurso | URL |
|---|---|
| Firebase Console | https://console.firebase.google.com |
| Projeto | https://console.firebase.google.com/project/fluxo-de-caixa-90548 |
| Authentication | https://console.firebase.google.com/project/fluxo-de-caixa-90548/authentication/users |
| Firestore | https://console.firebase.google.com/project/fluxo-de-caixa-90548/firestore |
| Hosting | https://console.firebase.google.com/project/fluxo-de-caixa-90548/hosting |
| Sistema (Fluxo de Caixa) | https://fluxo-de-caixa-90548.web.app |
| Sistema (Orçamento) | https://fluxo-de-caixa-90548.web.app/orcamento.html |

### Comandos PowerShell

```powershell
# Publicar atualizações
cd "C:\Users\luiz\Documents\eco-deploy"; firebase deploy

# Abrir o site no navegador
firebase open hosting:site

# Ver projetos disponíveis
firebase projects:list
```

### Firebase SDK utilizados

```html
<script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore-compat.js"></script>
```

---

## Fluxo Completo de Acesso

```
Usuário acessa a URL
        ↓
Firebase verifica sessão
        ↓
   ┌────┴────┐
   ↓         ↓
Logado    Não logado
   ↓         ↓
Firestore  Tela de
consulta   Login
permissões    ↓
   ↓      Digita e-mail
   ↓      + senha
   ↓         ↓
┌──┴──┐   Firebase
↓     ↓   valida
Tem   Sem     ↓
acesso acesso  ↓
  ↓     ↓   (volta ao início)
Abre  Tela
módulo "Acesso
       Negado"
```

---

*Atualizado em maio de 2026 — Projeto ECO | Sistema de Gestão 2026*
