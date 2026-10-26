# Preparação de testes de primeiro acesso — 16/10/2026

> Registro histórico da preparação inicial. As pendências e autorizações mencionadas abaixo se referem àquela etapa. As execuções posteriores estão em RESULTADO_TESTES_AUTH_ISOLADOS.md e RESULTADO_TESTES_AUTH_POSTGRES.md; consulte RELATORIO_AUTH_PRIMEIRO_ACESSO.md para a situação consolidada. Nenhum teste foi executado na organização para o commit.

Worktree exclusivo: `C:\Users\carla58380986\Downloads\SAP-auth-primeiro-acesso`.
Branch: `fix/auth-primeiro-acesso`.

Esta etapa preparou arquivos, sem iniciar Docker, PostgreSQL, frontend ou backend e sem executar testes, build ou instalação de dependências. Não houve conexão ao Supabase, uso de credenciais reais, commit, push, merge ou deploy.

## Arquivos criados nesta etapa

- `backend/src/test/resources/application-auth-isolated.properties`: banco H2 somente em memória, chave JWT fictícia, sem inicialização SQL ou migrações.
- `frontend/vite.auth.config.ts`: servidor de navegador exclusivo em `127.0.0.1:4186`, sem leitura de `.env`, sem proxy e com endereço de API fixado localmente. Requisições de autenticação e unidades que escaparem da simulação recebem 503.
- `frontend/vitest.auth.config.ts`: seleciona somente `src/auth/login.test.ts`, usa jsdom e fixa a API local, sem carregar `.env`.
- Este documento: escopo, arquivos e próxima etapa.

## Arquivos ajustados nesta etapa

- `backend/src/test/java/br/com/sap/FirstAccessAuthenticationTests.java`: carrega apenas o arquivo de configuração isolado, mantém H2 e JWT fictício explicitamente no teste. O inicializador de contas continua substituído por mock; as contas são fictícias e as requisições usam MockMvc, sem servidor HTTP.
- `frontend/playwright.auth.config.ts`: passa a usar a configuração Vite isolada, mantendo porta exclusiva e proibição de reutilizar um servidor existente. Sua execução futura iniciará um frontend local; por isso depende de autorização.
- `frontend/src/auth/login.test.ts`: qualquer chamada fetch sem resposta simulada falha imediatamente, sem usar a rede.
- `RELATORIO_AUTH_PRIMEIRO_ACESSO.md`: distingue os registros anteriores da preparação atual, ainda sem execução.

## Arquivos que já estavam alterados ou criados

Foram preservadas as alterações anteriores em `backend/src/main/java/br/com/sap/config/SecurityConfig.java`, `frontend/src/api/client.ts`, `frontend/src/components/panel/PanelShell.jsx`, `frontend/src/pages/LandingPage.jsx`, `frontend/src/auth/login.ts` e `frontend/e2e/first-access.spec.ts`.

Os cenários já preparados cobrem primeiro acesso, troca de senha com o token novo, cancelamento, falha na troca, logout e novo login. O backend também cobre contas existentes, cookie, token ausente/inválido/expirado e conta inativa. O navegador simula a API e bloqueia requisições externas; esses cenários não foram executados nesta etapa.

## Próxima etapa — somente após autorização

Revisar e executar os comandos abaixo a partir dos diretórios indicados. Não executar o fluxo padrão de desenvolvimento ou a configuração Playwright geral para esta validação.

1. Em `frontend`: `npx --no-install vitest run --config vitest.auth.config.ts`.
2. Em `backend`: `.\gradlew.bat test --tests br.com.sap.FirstAccessAuthenticationTests --console=plain --rerun-tasks` com JDK 17. Usa H2/MockMvc; não requer PostgreSQL ou backend HTTP. O Gradle pode precisar baixar dependências se não estiverem no cache.
3. Em `frontend`, com autorização também para iniciar o frontend local: `npx --no-install playwright test --config playwright.auth.config.ts`. Requer Microsoft Edge disponível; não inicia backend.

Não é necessário Docker nem Supabase para essa sequência. Qualquer validação com PostgreSQL local seria uma etapa separada, ainda não preparada nem autorizada.

Verificação desta etapa: somente leitura dos arquivos e inspeção estática do diff. Resultados de testes permanecem pendentes.
