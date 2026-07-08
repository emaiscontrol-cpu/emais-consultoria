# Plano de Implementação — Geração de Setup Atualizado do Electron (v2.6.2p)

Este plano descreve as etapas para empacotar o cliente desktop Electron na versão atualizada `2.6.2p`, gerando o instalador correspondente na pasta de builds `C:\Temp\emais-build`, resolvendo o desalinhamento de versões entre as máquinas de produção.

---

## 1. Contexto e Diagnóstico

* **O Problema:** A outra máquina do usuário apresenta dados diferentes ou incompletos de tarefas/cadastros porque está rodando uma versão antiga do Electron client (v2.5.0 ou anterior), a qual aponta para caminhos de API antigos ou sofre com bugs de tenant e cache que foram corrigidos nas versões recentes (`v2.6.x`).
* **A Solução:** Compilar um novo executável instalador (`E Mais Consultoria Setup 2.6.2p.exe`) a partir do código do diretório `electron-client/`. A versão já está bumpada para `2.6.2p` no `package.json` do Electron.
* **Pasta de Destino:** O builder salvará o instalador em `C:\Temp\emais-build`, onde ficam os setups das versões anteriores (`2.0.0-f`, `2.5.0-y`, etc.).

---

## 2. Etapas de Execução

1. **Acessar o diretório do Electron:** Navegar para `electron-client/`.
2. **Executar build de empacotamento:** Rodar `npm run build` que chamará o `electron-builder` para empacotar a versão Windows x64.
3. **Verificação:** Confirmar que o arquivo `E Mais Consultoria Setup 2.6.2p.exe` foi gerado em `C:\Temp\emais-build`.
4. **Relatório final:** Notificar o usuário sobre a geração do setup atualizado para que ele possa instalá-lo na outra máquina.
