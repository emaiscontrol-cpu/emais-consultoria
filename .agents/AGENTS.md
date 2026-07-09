# Padrões de Usabilidade de Teclado e Formulários

Este documento registra regras específicas de experiência do usuário (UX) para formulários e interações pelo teclado no sistema E Mais Consultoria.

## Regras de UX e Acessibilidade por Teclado

1. **Submissão com Tecla Enter**:
   - Em qualquer formulário, se todos os campos obrigatórios já estiverem preenchidos (seja automaticamente por carregamento de credenciais salvas ou manualmente pelo usuário), a tecla `Enter` em qualquer campo de texto ativo deve realizar a submissão direta do formulário.
   - Isso evita a necessidade de o usuário pressionar `Tab` repetidamente ou ter que clicar no botão de confirmação quando os dados já estão prontos.

2. **Navegação de Foco entre Campos**:
   - Em formulários com múltiplos campos vazios, a tecla `Enter` deve focar o próximo campo lógico vazio em vez de submeter o formulário diretamente, guiando o usuário no preenchimento passo a passo.
   - O último campo do formulário deve sempre submeter as informações ao pressionar `Enter`.

3. **Auto-foco em Campos de Tamanho Fixo**:
   - Campos de tamanho fixo conhecido (por exemplo, o Código de Acesso do usuário que possui exatamente 3 dígitos) devem focar automaticamente o próximo campo do fluxo assim que o número total de caracteres permitidos for inserido.
   - Isso impede que o cursor de texto continue piscando em um campo já concluído e agiliza o fluxo de interação do usuário.

## Organização de Documentos de Planejamento (IA)

1. **Localização de Planos, Tarefas e Validações**:
   - Todo plano de implementação (`implementation_plan.md`), checklist de tarefas (`task.md`) e registro de validação final (`walkthrough.md`) gerado por agentes de IA deve ser criado e mantido **diretamente na raiz do repositório** (na mesma pasta onde se encontra o `CLAUDE.md`).
   - Evitar mantê-los exclusivamente nas pastas locais de cache do agente (`.gemini/antigravity/`), garantindo que o histórico e o andamento das decisões fiquem sempre registrados no controle de versão (Git).
