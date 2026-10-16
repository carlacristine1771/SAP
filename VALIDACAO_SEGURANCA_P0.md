# Validação da segurança P0 — 16/10/2026

> A validação inicial abaixo é um registro histórico. A pendência do seletor foi corrigida e revalidada nesta mesma branch; os resultados vigentes e o parecer final estão na seção “Conclusão da pendência do seletor”, ao final deste documento.

## Escopo e isolamento

Trabalho no worktree `C:/Users/carla58380986/Downloads/SAP-seguranca-autenticacao`, branch `fix/seguranca-autenticacao`, HEAD `62bb611989edc5f8ee4cd3c703687b31d2536189`.

Esta validação acrescentou somente testes, configurações de testes e documentação. As alterações de implementação P0 já existentes foram preservadas. Nenhuma outra correção de segurança foi implementada. Não foram executados commit, push, merge ou deploy, nem alterações nas demais branches/worktrees.

O backend foi executado com Java 17, Gradle offline, configuração exclusiva de testes, H2 em memória e `DataInitializer` simulado. Os dados foram criados com nomes fictícios e e-mails `example.invalid`. Não foram iniciados os perfis normais da aplicação nem testes PostgreSQL.

O navegador usou Edge headless em desktop e viewport de celular, Vite exclusivo em `127.0.0.1:4186`, sem leitura de `.env` e sem proxy de API. As APIs foram simuladas. Rotas de navegador interceptaram requisições externas; fontes Google receberam CSS vazio localmente. Proxy inválido e regras de DNS também bloquearam tráfego externo do navegador. Não houve acesso a Supabase, Render ou Vercel de produção. `npm ci` instalou apenas dependências do projeto.

## Backend

| Suíte | Aprovados | Falhas/erros | Ignorados |
| --- | ---: | ---: | ---: |
| `UserManagementPermissionsTests` (preservada) | 144 | 0 | 0 |
| `FirstAccessAuthenticationTests` (preservada) | 11 | 0 | 0 |
| `UserManagementH2IntegrationTests` (nova) | 18 | 0 | 0 |
| Total | **173** | **0** | **0** |

Os 155 testes anteriores foram efetivamente reexecutados com `--rerun-tasks`, sem alteração ou remoção de seus casos. Resultado: `BUILD SUCCESSFUL`.

A nova suíte usa controllers, filtros de segurança, login e JWT reais, serviços transacionais e repositórios JPA reais com H2. Os métodos de teste não têm transação externa: as verificações JDBC enxergam o estado após o término das operações dos serviços.

Cobertura adicional:

- Administrador geral, administrador de unidade, Coordenação, Instrutor e Psicólogo; também a representação legada de administrador de unidade.
- Diretório e contatos: exclusão de contas inativas, ausência de senha no JSON, escopo dos administradores de unidade e preservação do administrador geral para os perfis operacionais.
- Cadastro de instrutor local pela Coordenação, senha inicial codificada e marcação de primeiro acesso.
- Edição de instrutor local com senha omitida preservando o hash; edição com nova senha persistindo o hash correto.
- Exclusão permitida para administradores e negada para Coordenação e perfis operacionais.
- Criação, edição e exclusão sem permissão, operações entre unidades, promoção e conversão de outro perfil para instrutor: **403** nos casos testados.
- Snapshot de todas as colunas de todas as tabelas da aplicação antes e depois de cada operação negada, incluindo conta inativa com credenciais colidentes: **nenhuma alteração**.
- Operações sem autenticação: **401**, sem alteração das tabelas.
- Envio, listagem, descriptografia e confirmação de leitura de chat para todos os perfis testados.

## Frontend e navegador

Os **28 testes de frontend passaram** (5 arquivos), incluindo autenticação, validações, infraestrutura de interface, query client e navegação/acessibilidade dos painéis. `npm run typecheck` passou.

Resultado final do Playwright: **23 aprovados, 2 falhos e 1 ignorado**, em 26 casos, sem retries. As duas falhas reproduzem o mesmo problema do seletor em desktop e celular. O caso ignorado é o teste de largura de calendário no projeto desktop, deliberadamente exclusivo do celular; sua execução no projeto mobile passou. `git diff --check` passou, sem erros de whitespace.

As fixtures antigas de `nativePanels.test.jsx` e `panels.spec.ts` precisavam de token fictício no armazenamento local, pois `useSessionQuery` só consulta `/auth/me` quando há token. Foram corrigidas apenas essas fixtures, preservando as asserções existentes. A primeira execução sem essa preparação falhou em quatro testes de componentes e no teste de navegação do navegador; esses bloqueios de preparação foram resolvidos.

A suíte de navegador cobre os cinco perfis em desktop e celular: carregamento do painel, listagens, filtro de usuários, contatos, busca de destinatário, seleção de contato, envio e atualização do chat. Também exercita cadastro e edição de instrutor pela Coordenação, com senha opcional e redefinição de senha, além da apresentação de erro 403 mantendo formulário e dados simulados.

### Pendência encontrada no seletor da turma

O teste `coordenacao: cadastra, edita instrutor e preserva seletor de turma` chega ao seletor após concluir cadastro e duas edições do instrutor. A asserção de opções locais falha porque aparece **Instrutor Outra Unidade**, além dos instrutores locais esperados.

Em `frontend/src/pages/OperationalPage.jsx`, o seletor usa `data.users.filter(u => u.tipoUsuario === "INSTRUTOR")`, enquanto a lista de instrutores usa os dados filtrados por unidade. A consulta operacional de usuários preservada pela P0 retorna o diretório usado para contatos. Assim, o seletor continua incluindo o instrutor estrangeiro.

O mesmo trecho já consta de `git show HEAD:frontend/src/pages/OperationalPage.jsx`; esse arquivo não tem diferenças no worktree. Portanto, trata-se de comportamento preexistente ao diff P0, identificado pela nova cobertura. Não foi corrigido nem foi relaxada a asserção para esconder a falha.

## Reprodução e evidências

Em `backend`, com `JAVA_HOME` apontando para Java 17:

```powershell
.\gradlew.bat --offline --no-daemon test --rerun-tasks --tests br.com.sap.UserManagementPermissionsTests --tests br.com.sap.FirstAccessAuthenticationTests --tests br.com.sap.UserManagementH2IntegrationTests
```

Em `frontend`:

```powershell
npx vitest run --config vitest.p0.config.ts
npx playwright test --config playwright.p0.config.ts
npm run typecheck
```

Artefatos locais:

- `backend/build/reports/tests/test/index.html` e `backend/build/test-results/test/TEST-*.xml`.
- `backend/build/p0-validation.log`.
- `frontend/p0-unit.log` e `frontend/p0-browser.log`.
- `frontend/test-results/p0-results.json` e contextos de falha em `frontend/test-results/p0/`.

Limite: os testes de navegador usam APIs simuladas; a política real e a persistência são verificadas separadamente pela integração H2. Esta etapa não executou um navegador conectado a backend real nem validação de infraestrutura de produção.

## Parecer

A política P0 passou nos testes de backend, com os **155 testes anteriores preservados**, e os fluxos principais dos painéis passaram nas verificações executadas. Entretanto, a validação completa não está verde devido ao seletor de instrutores entre unidades. **Não recomendo declarar a P0 integralmente validada e pronta para commit sem ressalvas enquanto essa pendência não for triada.** A pendência é preexistente e não demonstra regressão causada pela implementação P0. Nenhum commit foi criado.

## Conclusão da pendência do seletor

Correção e revalidação feitas exclusivamente em `SAP-seguranca-autenticacao`, branch `fix/seguranca-autenticacao`, mantendo HEAD `62bb611989edc5f8ee4cd3c703687b31d2536189`. As alterações P0 que já estavam no worktree foram preservadas. Não houve commit, push, merge, deploy ou edição dos demais worktrees/branches. Nenhuma outra correção de segurança foi implementada.

### Origem e correção

- Frontend: o seletor de criação/edição de turma filtrava o diretório compartilhado apenas pelo perfil `INSTRUTOR`. Agora exige instrutor ativo, unidade vinculada e igualdade com a unidade da sessão. Coordenação sem unidade recebe somente a opção “Sem instrutor”. O diretório compartilhado, os contatos e o chat não foram alterados.
- Backend: a comparação existente entre instrutor e turma não restringia a unidade informada pela Coordenação. Alterar conjuntamente os IDs de curso, unidade e instrutor permitia contornar essa comparação; instrutores sem unidade também passavam pela verificação. Agora, em criação e edição, a unidade solicitada deve ser a da Coordenação; a turma existente também deve ser local na edição. O instrutor deve ser ativo, ter perfil `INSTRUTOR` e pertencer à unidade. As recusas retornam **403**, antes de qualquer gravação ou alteração da entidade.
- Administrador geral: manteve as regras anteriores. A integração comprova criação em outra unidade, retirada e nova atribuição de instrutor, com persistência real. A opção legítima de deixar a turma sem instrutor também foi preservada para a Coordenação.

### Arquivos alterados nesta conclusão

- `backend/src/main/java/br/com/sap/service/TurmaService.java`.
- `frontend/src/pages/OperationalPage.jsx`.
- `backend/src/test/java/br/com/sap/UserManagementH2IntegrationTests.java` (quatro execuções adicionais de integração).
- `frontend/e2e/permissions.p0.spec.ts` (regressão existente fortalecida e dois novos casos em desktop/celular).
- `VALIDACAO_SEGURANCA_P0.md`.

### Resultados finais

| Verificação | Aprovados | Falhas/erros | Ignorados |
| --- | ---: | ---: | ---: |
| `UserManagementPermissionsTests` | 144 | 0 | 0 |
| `FirstAccessAuthenticationTests` | 11 | 0 | 0 |
| `UserManagementH2IntegrationTests` | 22 | 0 | 0 |
| Backend total | **177** | **0** | **0** |
| Vitest (5 arquivos) | **28** | **0** | **0** |
| Playwright (desktop e celular) | **29** | **0** | **1** |

O único caso ignorado continua sendo o calendário exclusivo de celular no projeto desktop; o correspondente mobile passou. Os testes de permissões, primeiro acesso, contatos e chat foram reexecutados. `npm run typecheck` e `git diff --check` passaram.

A integração cobre POST e PUT com instrutor estrangeiro, inativo, sem unidade ou de outro perfil; adulteração conjunta de unidade/curso/instrutor; tentativa de editar turma estrangeira; Coordenação sem unidade; atribuição local e remoção de vínculo. Cada requisição negada verifica um snapshot de todas as colunas e tabelas da aplicação, confirmando ausência de alterações persistidas.

Foram usados somente dados fictícios, H2 em memória e configuração de testes com seed simulado. O Gradle foi executado offline. O navegador utilizou o servidor local isolado e APIs simuladas, com bloqueio de tráfego externo, como na validação inicial. Nenhum ambiente ou dado de produção foi usado.

Comandos de reprodução: os três comandos da seção anterior continuam válidos, incluindo `--rerun-tasks` no backend. Evidências desta execução: `backend/build/p0-selector-validation.log`, `backend/build/test-results/test/TEST-*.xml`, `frontend/p0-selector-unit.log`, `frontend/p0-selector-browser.log` e `frontend/test-results/p0-results.json`.

**Parecer final: a pendência foi resolvida e a P0 está pronta para commit no escopo validado.** Este parecer substitui a ressalva da validação inicial. O navegador usa APIs simuladas; a validação real das requisições, filtros, JWT e persistência foi realizada separadamente com MockMvc/H2. Não foi executado navegador conectado a backend real nem avaliação de infraestrutura de produção. Nenhum commit foi criado.
