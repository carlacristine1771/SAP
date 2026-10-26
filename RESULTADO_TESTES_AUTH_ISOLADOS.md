# Testes isolados de autenticação — 16/10/2026

> Execução anterior concluída e registrada, não repetida na organização para o commit. Os números abaixo pertencem àquela execução. O XML H2 citado foi substituído pela execução PostgreSQL; o marcador local do navegador continua indicando passed, sem contagem. A etapa PostgreSQL mencionada como próxima ao final deste registro já foi concluída conforme RESULTADO_TESTES_AUTH_POSTGRES.md.

Execução autorizada na branch `fix/auth-primeiro-acesso`, no worktree `C:/Users/carla58380986/Downloads/SAP-auth-primeiro-acesso`.

## Resultado desta execução

| Suíte | Aprovados | Falhas | Ignorados |
| --- | ---: | ---: | ---: |
| Backend — FirstAccessAuthenticationTests | 11 | 0 | 0 |
| Frontend — src/auth/login.test.ts | 15 | 0 | 0 |
| Navegador — first-access.spec.ts, desktop e celular | 6 | 0 | 0 |
| Total | 32 | 0 | 0 |

Backend: primeiro acesso, troca de senha usando o bearer novo apesar de cookie antigo, logout e novo login, rejeição da senha antiga, contas existentes dos cinco perfis, autenticação por cookie, token ausente/inválido/expirado, senha atual incorreta, nova senha inválida, conta inativa e proteção dos endpoints.

Frontend: token explícito, persistência somente após sucesso, cancelamento, senha inválida, falhas HTTP/rede, falha no logout de limpeza, credenciais inválidas, resposta sem token, divergência de perfil/unidade e contas existentes.

Navegador: primeiro acesso/troca/logout/novo login, cancelamento e falha na troca, nos dois projetos. Todos usam API fictícia.

## Isolamento verificado antes da execução

- Backend seleciona exclusivamente a classe de autenticação. Configuração Spring fixa H2 em memória, usuário `sa`, senha vazia e JWT fictício; DataInitializer substituído por mock. MockMvc não inicia servidor HTTP. Código carregado não utiliza cliente de rede externo.
- O XML confirma `jdbc:h2:mem:first_access_test`, 11 testes e zero falhas/erros/ignorados.
- Vitest usa a configuração exclusiva, sem leitura de `.env`, API local fixa e fetch totalmente simulado; chamada não simulada lança erro.
- Playwright inicia Vite exclusivo em `127.0.0.1:4186`, sem reutilizar servidor, sem proxy de API e sem leitura de `.env`. Service workers bloqueados; rotas externas abortadas e API simulada antes de navegar.
- A configuração exclusiva Playwright recebeu proteção adicional: rede de segundo plano desabilitada, DNS externo bloqueado e proxy inválido em `127.0.0.1:9`, com exceção apenas para localhost. Isso cobre também preconexões das fontes externas presentes no HTML.
- Nenhuma variável de ambiente de Spring, datasource, JWT, Vite, proxy, Java/Node options ou Playwright foi encontrada na inspeção dos nomes. Nenhum arquivo de credenciais reais foi carregado.
- Gradle executado offline, com JDK 17. Ferramentas frontend usadas diretamente de node_modules, sem instalação ou download.
- Sem conexão com Supabase, Render ou Vercel. Nenhum teste dependente de serviço externo ou credenciais reais foi executado.

## Comandos executados

Backend, com JAVA_HOME temporário para JDK 17:

```powershell
.\gradlew.bat test --tests br.com.sap.FirstAccessAuthenticationTests --offline --console=plain --rerun-tasks
```

Frontend:

```powershell
.\node_modules\.bin\vitest.cmd run --config vitest.auth.config.ts
.\node_modules\.bin\playwright.cmd test --config playwright.auth.config.ts
```

Evidências geradas: `backend/build/test-results/test/TEST-br.com.sap.FirstAccessAuthenticationTests.xml`, `backend/build/reports/tests/test/index.html` e `frontend/test-results/.last-run.json`. Saída Vitest: 15 passed; Playwright: 6 passed; Gradle: BUILD SUCCESSFUL.

## Preservação e próxima etapa

Comparação SHA-256 com baseline coletado antes da execução: arquivos de produção preservados e arquivos do worktree original `SAP` preservados. A única configuração alterada nesta execução é `frontend/playwright.auth.config.ts`; este relatório foi criado. As alterações que já existiam foram preservadas. `git diff --check` aprovado.

Sem commit, push, merge ou deploy. Branch original continua `fix/formularios-validacoes`; branch de testes continua `fix/auth-primeiro-acesso`.

A correção está pronta para avançar à validação com PostgreSQL isolado. Isso ainda precisa verificar o comportamento com o banco real e o fluxo integrado entre navegador e backend: os cenários de navegador desta etapa usam API simulada e o backend usa H2. PostgreSQL não foi iniciado nem testado nesta execução. Os resultados históricos de outras suítes no relatório anterior não foram revalidados aqui.
