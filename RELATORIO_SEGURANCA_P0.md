# Segurança P0 — criação e gerenciamento de usuários

> Validação posterior com integração H2 e navegador: consulte [VALIDACAO_SEGURANCA_P0.md](VALIDACAO_SEGURANCA_P0.md). O resultado posterior é de 173 testes de backend e 28 de frontend aprovados; no navegador, 23 aprovados, 2 falhos por seletor preexistente entre unidades e 1 ignorado por ser exclusivo do celular. A seção de validação abaixo registra a etapa inicial de implementação.

## Isolamento do trabalho

- Branch criada: `fix/seguranca-autenticacao`.
- Base verificada: `62bb611989edc5f8ee4cd3c703687b31d2536189`, também HEAD de `fix/auth-primeiro-acesso` no momento da criação.
- Worktree: `C:\Users\carla58380986\Downloads\SAP-seguranca-autenticacao`.
- A branch não existia e a pasta estava livre antes de `git worktree add`.
- Nenhum arquivo dos outros worktrees foi alterado. Nenhum commit, push, merge ou deploy realizado.

## Dependências identificadas antes das alterações

| Tela/componente | APIs e finalidade | Compatibilidade |
| --- | --- | --- |
| `frontend/src/pages/AdminPage.jsx` | `GET /usuarios` para dashboard, contagens, lista e chat; `POST /auth/register`; `PUT /usuarios/{id}`; `DELETE /usuarios/{id}` | Administração geral preservada; administrador de unidade só consulta e gerencia a própria unidade. |
| `frontend/src/pages/OperationalPage.jsx` | Coordenação e Instrutor carregam `GET /usuarios`; seleção de instrutores para turmas e chat; Coordenação cadastra e edita instrutores com senha opcional | Coordenação mantém criação/edição de instrutores da própria unidade, incluindo definição de senha. Não pode converter outro perfil em instrutor, promover, transferir ou excluir usuários. |
| `frontend/src/pages/PsychologistPage.jsx` | `GET /usuarios` para contatos do chat | Leitura existente preservada; nenhuma permissão de escrita administrativa. |
| `frontend/src/components/panel/ChatPanel.jsx` | Usa a lista recebida dos painéis, inclusive contatos com administrador geral nos painéis operacionais | Consulta dos perfis operacionais preservada para não remover contatos legítimos. |

Os painéis operacionais filtram a própria unidade e incluem usuários sem unidade no chat. Restringir indiscriminadamente `GET /usuarios` nesses perfis removeria o administrador geral dos contatos. A P0 preserva essas leituras; não adiciona uma revisão geral de visibilidade de dados.

## Política implementada

| Perfil autenticado | Criar | Editar, inclusive senha/perfil/unidade | Excluir |
| --- | --- | --- | --- |
| Administrador geral (`ADMINISTRADOR` sem unidade) | Todos os perfis | Todos os perfis e unidades | Outros usuários; permanece a proibição de excluir o próprio login |
| Administrador de unidade (`ADMIN_UNIDADE` ou `ADMINISTRADOR` com unidade) | Somente na própria unidade | Alvo e unidade solicitada devem pertencer à própria unidade; não alcança administrador geral | Somente na própria unidade, sem excluir o próprio login |
| Coordenação | Somente instrutor na própria unidade | Somente instrutor existente na própria unidade, mantendo perfil e unidade; inclui a senha opcional já presente no painel | Não |
| Instrutor / Psicólogo | Não | Não; troca da própria senha continua em `/auth/change-password`, exigindo senha atual | Não |
| Administrador de unidade sem vínculo | Não | Não | Não |

- A política compartilhada consulta o usuário ativo atual no backend; não confia no perfil enviado no corpo da requisição.
- Bloqueios de autorização geram `AccessDeniedException`, traduzida em HTTP **403**, antes de gravar ou anonimizar credenciais de contas inativas.
- Requisições sem autenticação continuam recebendo **401** pela cadeia de segurança existente.
- Uma unidade diferente ou nula é rejeitada para administradores de unidade e Coordenação, em vez de ser silenciosamente substituída.
- `GET /usuarios/{id}` também verifica o escopo do administrador de unidade.
- Mantida a representação legada de administrador de unidade como `ADMINISTRADOR` com unidade preenchida.
- Cadastro e edição são transacionais. A exigência de unidade para perfis não globais também se aplica à edição.
- Nenhuma alteração de frontend, banco, infraestrutura, sessão ou outras etapas de segurança.

## Arquivos de implementação e testes

- `backend/src/main/java/br/com/sap/security/UsuarioPermissions.java` — política compartilhada (novo).
- `backend/src/main/java/br/com/sap/service/AuthService.java` — autorização de cadastro antes de qualquer alteração.
- `backend/src/main/java/br/com/sap/service/UsuarioService.java` — autorização de leitura administrativa, edição e exclusão.
- `backend/src/main/java/br/com/sap/controller/UsuarioController.java` — encaminha autenticação na consulta individual.
- `backend/src/main/java/br/com/sap/exception/GlobalExceptionHandler.java` — resposta JSON 403.
- `backend/src/test/java/br/com/sap/UserManagementPermissionsTests.java` — matriz de permissões com dados fictícios (novo).
- Este relatório.

## Validação isolada

Com Java 17, a partir de `backend`:

```powershell
.\gradlew.bat --offline --no-daemon test --tests br.com.sap.UserManagementPermissionsTests --tests br.com.sap.FirstAccessAuthenticationTests
```

`UserManagementPermissionsTests` usa MockMvc standalone com controllers, serviços, política e tratamento de exceções reais. Repositórios e codificador são simulados: não inicia contexto Spring, servidor, datasource, seed ou leitura de configurações da aplicação. Os testes verificam HTTP 403, ausência de gravações, preservação das senhas e dos demais dados em operações negadas, incluindo acessos entre unidades e tentativas de promoção/destituição de perfis administrativos.

`FirstAccessAuthenticationTests` é a regressão existente, com 11 testes: usa H2 em memória, configuração exclusiva `application-auth-isolated.properties`, URL/driver H2 sobrescritos explicitamente na anotação e `DataInitializer` simulado. Confirma login por e-mail/login, primeiro acesso, cookie/Bearer, troca da própria senha, senha atual inválida, tokens inválidos/expirados e conta inativa.

Somente essas duas classes são executadas; testes PostgreSQL e testes que usam configuração normal da aplicação não são executados. Gradle roda com `--offline`. Não houve conexão com Supabase ou produção.

Os resultados finais ficam em `backend/build/reports/tests/test/index.html` e `backend/build/test-results/test/`. A verificação de whitespace é feita com `git diff --check`.

Resultado final: **155 testes aprovados**, sendo **144 de permissões** e **11 de regressão de primeiro acesso**, sem falhas, erros ou testes ignorados. `BUILD SUCCESSFUL`; `git diff --check` sem apontamentos.

## Funcionalidades afetadas e limites

- Chamadas manuais que antes permitiam a perfis operacionais criar administradores, redefinir senhas de outros perfis, trocar unidade ou excluir usuários passam a retornar 403.
- Administrador de unidade perde acesso direto por ID a usuários de outra unidade ou ao administrador geral, coerente com a restrição já existente na lista.
- Coordenação continua cadastrando/editando instrutores locais e definindo sua senha pelo fluxo existente; redefinições de senha de outros perfis são bloqueadas.
- Não foi executado teste visual/E2E dos painéis. A compatibilidade foi avaliada pelo mapeamento dos consumidores e pelos testes das APIs que esses fluxos utilizam.
- Outras etapas de segurança permanecem fora deste trabalho.
