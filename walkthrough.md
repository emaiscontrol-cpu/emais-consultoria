# Registro de Homologação Final — DRE Multi-Unidades

Todas as fases e requisitos extras do módulo de DRE e Comparativos com quebra de Unidades Contábeis (filiais) foram concluídos e validados localmente.

---

## 1. Refatorações de UI e Gestão de Filiais Aninhada (Sessão 15b)

### Gestão Transacional de Unidades Contábeis
* **Seção de Unidades Aninhada:** Removidos os botões soltos de unidades da listagem geral de clientes. A gestão de filiais agora reside de forma integrada e elegante **dentro dos próprios modais de Novo e Editar Cliente**.
* **Reutilização de Componente:** Foi implementado o mesmo componente reativo e robusto de gestão local de unidades em ambos os fluxos, salvando e cancelando transacionalmente de uma única vez contra o backend.
* **Novos Campos e Endereço:** Cada unidade conta agora com suporte a CNPJ, endereço completo (CEP, logradouro, número, complemento, bairro, cidade, estado) e validações ativas de tipo e duplicidade de código/nome.
* **Máscaras de Digitação:** Injetadas máscaras automáticas no frontend para facilitar o preenchimento de CNPJ (`00.000.000/0001-00`) e CEP (`00000-000`).

### Refinamentos Visuais e Exclusão em Duas Etapas
* **Ações com Ícones Padronizados:** O lápis fino foi substituído pelo ícone de lápis marcado `<Pencil size={15} />` (corretamente importado e herdado da biblioteca *lucide-react*), padronizando a listagem com o restante do sistema.
* **Exclusão de Clientes:** Adicionado o botão de lixeira vermelha `<Trash2 size={15} color="#ef4444" />` ao lado de editar na tabela de clientes.
* **Confirmação em Duas Etapas:** Tanto a exclusão de clientes na tabela quanto a remoção de filiais de dentro do modal são controladas por sub-modais de confirmação dedicados, exigindo clique explícito do usuário (ex: "Confirmar exclusão") antes de efetivar e garantindo que nenhuma exclusão acidental aconteça.

---

## 2. Testes de Regressão e Validação Estática
* A suíte de testes de API do backend foi executada e a resposta retornou **69/69 testes bem-sucedidos (100% verde)**.
* O build de produção do frontend Vite/React compilou com absoluto sucesso (`npm run build` bem-sucedido).
* O uvicorn local (porta 8000) e o Vite dev server (porta 5173) foram reiniciados em segundo plano na máquina de dev do Luiz.

## 3. Correção de Bug e Reorganização em Abas (Sessão 15c)

### Causa Raiz do Bug do Ícone de Excluir
* O botão de excluir cliente da listagem chamava `onClick={() => abrirExcluirCliente(c)}`, mas essa função **nunca havia sido definida** no componente — o clique disparava um erro de referência silencioso no console, sem nenhum feedback visual, dando a impressão de "botão sem ação". Corrigido implementando a função (`abrirExcluirCliente` → `setClienteExcluindo(c)`).

### Abas no Modal
* O modal de Novo/Editar Cliente foi dividido em duas abas ("Geral" e "Unidades"), removendo a rolagem própria de 200px que existia na tabela de unidades. Agora existe apenas uma área de rolagem (60vh) por aba ativa, eliminando o scroll duplo. A mesma estrutura serve para os dois fluxos (criar e editar), pois é o mesmo componente/modal.

### Nomenclatura e Validação de Código
* Toda a tela de Clientes teve os termos "Filial"/"Unidade Contábil" substituídos por "Unidade".
* O campo Código já bloqueava não-numéricos e limitava a 3 dígitos na digitação; foi adicionada uma segunda validação de duplicidade de código no momento do "Salvar" final (além da já existente no "Adicionar Unidade"), como reforço.

### Validação Ponta a Ponta
* Como o dev server local (uvicorn :8000 SQLite + Vite :5173) já estava no ar, a validação foi feita dirigindo um Chromium headless (Playwright já presente in `frontend/node_modules`) contra a UI real, autenticando com um usuário administrador temporário criado só para o teste (removido do SQLite local ao final). Capturas de tela confirmaram: modal de exclusão de cliente em 2 etapas abrindo corretamente; abas "Geral"/"Unidades" sem scroll aninhado (testado inclusive com o cliente Leal-MG, que tem 7 unidades cadastradas); modal de remoção de unidade em 2 etapas; toast de erro ao tentar salvar/adicionar unidade com código duplicado (nenhuma unidade foi de fato persistida durante o teste — todas as ações de confirmação foram canceladas propositalmente).

---

## 4. Correção de Vulnerabilidades no Backend (Sessão 16 / fix/seguranca-superficie-publica)

Nesta sessão, foram corrigidas três vulnerabilidades críticas de segurança no backend, fortalecendo a segurança de toda a superfície de API pública do sistema:

### A. Substituição de eval() por safe_eval()
* **Mitigação de RCE:** Substituição completa da função nativa do Python `eval()` por uma execução segura usando AST (`safe_eval()`) em [backend/routers/fc_exec.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/fc_exec.py).
* **Testes de RCE:** Foram criados testes unitários específicos em [tests/test_formulas.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_formulas.py) simulando expressões matemáticas legítimas e payloads maliciosos de escape de sandbox (como classes de mro e dunder methods), todos bloqueados com sucesso total.

### B. Trava Centralizada de Tenant no Backend
* **Injeção Unificada:** Criação de uma dependência única de validação `verificar_tenant(usuario, cliente_id)` no [backend/auth.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/auth.py).
* **Varredura Completa:** Aplicação da função em todas as rotas operacionais que lidam com dados específicos do cliente em diversos routers (`ref_demonstrativos`, `bandeiras`, `anotacoes`, `fc_exec`, `dashboard`, `busca`, `orcamento`, `projetos`, `relatorios`, `subtarefas`, `tarefas` e `ref_unidades`).
* **Segurança Reforçada:** Perfis restritos (`analista`, `ger_projeto`, `ti`) com `cliente_id` inválido ou nulo agora recebem HTTP 403. Administradores e consultores têm acesso irrestrito.

### C. Isolamento de Credenciais e Diagnóstico de Admin
* **Version Público Protegido:** O endpoint `/api/version` público em [backend/main.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/main.py) foi modificado para expor **exclusivamente** a chave `version`.
* **Novo Diagnóstico:** Informações críticas (como a string de conexão do Supabase com senha mascarada, contagens de registros e caminhos internos) foram movidas para a nova rota `/api/admin/diagnostico` em [backend/routers/admin.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/admin.py), protegida estritamente com `Depends(requer_perfil("admin"))`.

### D. CORS e Segurança de Inicialização
* **Restrição de CORS:** O backend agora restringe o acesso aos hosts autorizados explicitamente (`http://localhost:5173` e `http://localhost:8001`), eliminando a diretiva aberta de wildcard (`*`).
* **Failsafe de Produção:** Caso o servidor seja iniciado em produção (banco de dados não-SQLite) sem que uma chave secreta segura (`SECRET_KEY`) seja definida no `.env`, o backend impede o boot imediatamente levantando um `RuntimeError`.

### E. Testes de Regressão e Validação
* A suíte de testes de API do backend foi estendida com a classe `TestDiagnosticoESeguranca` em [tests/test_api.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_api.py) validando estritamente os quatro cenários exigidos:
  * (a) GET `/api/version` sem token retorna apenas a chave `"version"`.
  * (b) GET `/api/admin/diagnostico` sem token retorna 401 Unauthorized.
  * (c) GET `/api/admin/diagnostico` com token de perfil consultor retorna 403 Forbidden.
  * (d) GET `/api/admin/diagnostico` com token admin retorna 200 OK e a URL do banco vem com a senha mascarada (contendo `***` nas credenciais).
* Execução geral final obteve **79/79 testes com sucesso absoluto (100% verde)**.


