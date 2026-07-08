# Registro de Homologação Final — DRE Multi-Unidades

Todas as fases e requisitos extras do módulo de DRE e Comparativos com quebra de Unidades Contábeis (filiais) foram concluídos e validados localmente.

---

## 1. Ajustes e Recursos Adicionados (Fase de Homologação)

### Readequação de Menus e Telas
* **Readequação da Sidebar:** O item de menu **"DRE Gerencial"** foi renomeado para **"DRE Referencial"** e aponta para a nova rota `/controladoria/dre` que renderiza o componente avançado multilojas. O item duplicado "Demonstrativo Ref." foi removido.
* **Títulos e Descrições:** Cabeçalho do demonstrativo atualizado de forma concisa e focado apenas em DRE contábil, eliminando textos de orçamento/fluxo de caixa que já residem em outros locais.

### Vínculo Automático de Template
* **Template DRE Padrão do Cliente:** Adicionado o campo `template_dre_padrao_id` na model e no schema de clientes. No modal de Clientes, há agora um seletor para escolher o template padrão.
* **Auto-Seleção:** Ao entrar na DRE Referencial e escolher o cliente, o template DRE padrão dele é pré-selecionado automaticamente na tela, acelerando o carregamento dos dados.

### Validação do Módulo Ativo
* **Restrição de Acesso:** O backend e o frontend agora barram o carregamento de relatórios e dados contábeis de clientes que não possuem a flag `modulo_analises_gerenciais` contratada e ativa no sistema.

### Correção de Visualização de Célula (Valor Zero)
* **Fórmula Implícita por Slug:** Linhas de agrupamento (sem fórmula explícita como CMV e Receita) que mostravam `0,00` por conta de nulo na fórmula agora buscam o valor do agrupamento contábil associado dinamicamente: `f"{{agrupamento:{linha.agrupamento_slug}}}"`. Com isso, a planilha renderiza os valores reais carregados e alterados instantaneamente!

### CRUD de Unidades no Painel Clientes
* **Localização Amigável:** Na listagem de clientes, adicionamos o botão verde **"Unidades"** ao lado de "Editar".
* **Modal Completo de Gestão:** Abre uma interface dedicada para listar, criar, editar e excluir as filiais (código de exatamente 3 dígitos numéricos e nome da loja) consumindo as APIs REST de forma segura.

---

## 2. Testes de Regressão e Validação Estática
* A suíte de testes de API do backend foi estendida e a execução retornou **69/69 testes bem-sucedidos (100% verde)**.
* O build de produção do frontend Vite/React foi concluído sem qualquer erro ou aviso (`npm run build` bem-sucedido).
* O script de seed local foi atualizado para ajustar as naturezas das contas do CMV/Deduções para `"soma"`, de modo a exibir sempre os valores positivos na planilha mantendo as subtrações corretas nas margens.
