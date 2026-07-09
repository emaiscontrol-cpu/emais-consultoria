# Plano de Implementação — Correção de Bugs de Integridade de Dados (fix/corrupcao-de-dados)

Este plano descreve as modificações necessárias para solucionar três bugs críticos de integridade de dados no sistema.

## Proposed Changes

### [Componente Frontend] - Unificação de Parse Monetário

#### [NEW] [shared.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/components/shared.jsx) (Adição de helper)
* Criar e exportar o helper `parseValorBR(str)` que replica a lógica de limpeza de strings monetárias do backend:
  * Remove símbolos de moeda (`R$`, `$`, `€`) e espaços.
  * Se contém vírgula E ponto, remove os pontos de milhar e substitui a vírgula por ponto.
  * Se contém apenas vírgula, substitui por ponto.
  * Converte via `parseFloat` e, caso resulte in `NaN`, retorna `0.0`.

#### [MODIFY] [DRE.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/DRE.jsx)
* Importar o helper `parseValorBR` de `../../components/shared` e substituir a lógica inline `parseFloat(String(...).replace(',', '.'))` por `parseValorBR(...)`.

#### [MODIFY] [Demonstrativo.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/Demonstrativo.jsx)
* Importar o helper `parseValorBR` de `../../components/shared` e substituir o parsing manual do input de edição inline pelo helper.

#### [MODIFY] [ModuloBase.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/ModuloBase.jsx)
* Importar `parseValorBR` e atualizar a função local `parseBRL(s)` para retornar `parseValorBR(s)`.

#### [MODIFY] [EditarOrcamento.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/EditarOrcamento.jsx)
* Importar `parseValorBR` e atualizar a função local `parseBRL(val)` para retornar `parseValorBR(val)`.

---

### [Componente Backend] - Importadores Atômicos e Seguros

#### [MODIFY] [orcamento.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/orcamento.py)
* Modificar `importar_orcamento` para processar e validar a planilha inteira em memória em um array de objetos `models.FCOrcamento`.
* Após a validação total, iniciar a gravação: executar o `DELETE` do orçamento anterior e o `INSERT` das novas linhas dentro do mesmo bloco try/except e commit/rollback transacional único.
* Em caso de falha de validação ou escrita, disparar `db.rollback()` e retornar HTTP 400.

#### [MODIFY] [importar_orcamento_planilha.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/importar_orcamento_planilha.py)
* Reorganizar de forma similar: carregar os dados em memória primeiro e executar `DELETE` + `INSERT` em transação unificada com rollback em caso de falha.

---

### [Componente Backend] - Tratamento de IntegrityError de CNPJ

#### [MODIFY] [clientes.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/clientes.py)
* Envolver os commits de gravação nas rotas `criar` (POST `/`) e `atualizar` (PUT `/{id}`) em blocos `try/except IntegrityError`.
* Em caso de erro de integridade de banco de dados, efetuar `db.rollback()` e lançar `HTTPException(400, "Já existe um cliente com este CNPJ")`.

---

### [Componente Testes] - Testes de Regressão

#### [MODIFY] [test_api.py](file:///c:/Users/luiz/OneDrive/Anexos/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_api.py)
* Adicionar testes unitários para a rota de importação de orçamentos, assegurando que o envio de uma planilha corrompida ou com dados inválidos a meio do arquivo não causa a deleção de registros de orçamentos previamente existentes (garantia de transação com rollback).
* Adicionar testes para o cadastro de clientes validando que a tentativa de criar um cliente com CNPJ duplicado ou atualizar para um CNPJ já existente retorna HTTP 400 com a mensagem `"Já existe um cliente com este CNPJ"`.

## Verification Plan

### Automated Tests
* Executar toda a suíte de testes do Pytest: `.\backend\venv\Scripts\pytest.exe tests/ -p no:warnings`.
* Garantir que o build de produção do frontend compila perfeitamente sem erros de imports: `npm run build` na pasta `frontend/`.
