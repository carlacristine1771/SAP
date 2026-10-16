# Correção de autenticação no primeiro acesso

> Consolidação para commit local — 16/10/2026. Nesta revisão não foram executados testes, builds ou serviços. A preparação inicial, as execuções posteriores e os resultados históricos são etapas distintas.

## Situação consolidada dos testes

| Situação | Escopo | Resultado e evidência |
| --- | --- | --- |
| Concluídos em execução anterior registrada | Testes isolados H2/MockMvc, Vitest e navegador com API simulada | 11 + 15 + 6 aprovados, conforme `RESULTADO_TESTES_AUTH_ISOLADOS.md`. Não reexecutados nesta revisão; o XML H2 foi substituído pela execução PostgreSQL. O marcador local do navegador indica `passed`, mas não informa quantidade. |
| Concluídos, com evidência local conferida nesta revisão | PostgreSQL descartável e navegador com API real local | XML JUnit: 12 testes, zero falhas/erros/ignorados. Log final: 2 cenários Playwright aprovados e `BUILD SUCCESSFUL`. Esses 2 cenários fazem parte de um dos 12 testes JUnit; não somar como 14. Ver `RESULTADO_TESTES_AUTH_POSTGRES.md`. |
| Históricos, sem revalidação nesta revisão | Seleção de 22 testes frontend, typecheck, build e suíte geral | Registros preservados abaixo. As 5 falhas da suíte geral eram relatadas como preexistentes; a comparação com a base não foi repetida nesta revisão. |
| Pendentes | Nova execução dos testes e das verificações gerais após esta organização | Não executada nesta etapa. Nenhum novo resultado de execução é declarado. Produção não foi validada nem acessada. |

O arquivo `PREPARACAO_TESTES_AUTH.md` descreve a etapa inicial, anterior às duas execuções registradas. O log `auth-postgres-run.log` contém uma tentativa anterior com falha (12 testes, 1 falha); o resultado final está em `auth-postgres-3311ef9ea4c1.log`. Os dois logs e `frontend/test-results-postgres/.last-run.json` são evidências locais preservadas e excluídas do versionamento por regras exatas no `.gitignore`.

## Isolamento

- Worktree: `C:\Users\carla58380986\Downloads\SAP-auth-primeiro-acesso`.
- Branch: `fix/auth-primeiro-acesso`, criada da `main` local em `7fda4943fa6dba637be5bcb7c871b409ca6831ab`.
- O diretório original permanece em `fix/formularios-validacoes`. Os arquivos modificados e novos foram comparados por SHA-256 antes e depois do trabalho.
- Registro das etapas anteriores: nenhum stash aplicado, nenhum arquivo de mockup utilizado e nenhum commit criado. Esta organização prepara o commit local autorizado; push, merge, deploy e acesso ao Supabase permanecem fora do escopo.
- Nenhuma alteração em CPF, formulários de cadastro, estilos ou estrutura visual.

## Alterações

- `frontend/src/api/client.ts`: respeita Authorization explícito e permite opções na chamada PATCH.
- `frontend/src/auth/login.ts` (novo): mantém o token recebido em memória durante o primeiro acesso e usa esse token explicitamente para trocar a senha. Salva o token uma única vez após o sucesso. Em erro ou cancelamento, remove o token local e tenta limpar os cookies via logout, preservando o erro original mesmo se a limpeza falhar.
- `frontend/src/pages/LandingPage.jsx`: utiliza esse fluxo, mantendo as verificações de perfil e unidade. Remove a gravação duplicada e o log de depuração.
- `frontend/src/components/panel/PanelShell.jsx`: importa o cliente HTTP usado no logout administrativo, permitindo limpar os cookies ao sair.
- `backend/src/main/java/br/com/sap/config/SecurityConfig.java`: remove a liberação genérica de `/auth/**`; login e logout permanecem públicos. Troca de senha, sessão e cadastro exigem autenticação; ausência de autenticação retorna 401.
- `frontend/src/auth/login.test.ts` (novo): testes do fluxo e do cliente HTTP com fetch simulado.
- `frontend/e2e/first-access.spec.ts` (novo): formulário real no navegador com API simulada, incluindo novo login, cancelamento e falha na troca.
- `frontend/playwright.auth.config.ts` (novo): servidor local exclusivo na porta 4186, sem reutilização de servidor e sem API de produção. Os testes bloqueiam requisições externas.
- `backend/src/test/java/br/com/sap/FirstAccessAuthenticationTests.java` (novo): integração com filtros de segurança, JWT, serviço, BCrypt e repositório H2 em memória. Inicializador da aplicação substituído por mock; somente contas fictícias.

## Resultados históricos — não revalidados nesta revisão

- `frontend`: `npx vitest run src/auth/login.test.ts`: 15 testes aprovados.
- `frontend`: testes selecionados de autenticação, validação e infraestrutura: 22 aprovados.
- `frontend`: `npx playwright test --config playwright.auth.config.ts`: 6 cenários aprovados, entre desktop e celular.
- `backend` com JDK 17: `gradlew.bat test --tests br.com.sap.FirstAccessAuthenticationTests --console=plain`: 11 testes aprovados. Inclui contas antigas dos cinco perfis, autenticação por cookie, prioridade do bearer novo sobre cookie de outra conta, senha antiga rejeitada após troca, novo login, senha atual incorreta, nova senha inválida, token ausente/inválido/expirado e conta inativa.
- `frontend`: `npm run typecheck` e `npm run build`: aprovados.
- `git diff --check`: aprovado.
- Suíte geral `npm test`: 23 aprovados e 5 falhas preexistentes. Uma em `queryClient.test.ts` por ausência de localStorage no ambiente Node e quatro em `nativePanels.test.jsx` que permanecem na tela de carregamento. As mesmas cinco falhas foram reproduzidas com o cliente HTTP original da main. Esses testes anteriores não foram modificados.

## Limites da validação

O navegador usa uma API simulada; a integração real do backend usa MockMvc e H2. Não foi realizada validação em produção. Se a rede falhar também no logout de limpeza, o token local permanece removido, mas o cliente não consegue garantir a remoção imediata do cookie HttpOnly no servidor.

## Revisão para o commit local

Revisão estática dos arquivos de código, testes, configurações e script incluídos. Nenhum arquivo .env faz parte da seleção. Senhas, tokens de exemplo e chaves JWT dos testes são fictícios; banco e API de teste apontam para loopback. As exclusões são específicas aos três artefatos indicados, sem uma regra genérica para outros logs.
