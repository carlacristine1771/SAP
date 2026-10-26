# Autenticação com PostgreSQL descartável — 16/10/2026

> Execução anterior concluída; evidências locais conferidas na organização para o commit em 16/10/2026: XML com 12 testes e zero falhas/erros/ignorados, log final com 2 cenários Playwright aprovados e BUILD SUCCESSFUL, marcador do navegador com passed. Nenhum serviço ou teste foi iniciado nesta revisão. As afirmações de isolamento e encerramento abaixo são registros daquela execução, sem nova inspeção dos serviços. HEAD e ausência de commit ao final descrevem o momento anterior ao commit autorizado. Os dois logs e o marcador JSON são preservados localmente e ignorados pelo Git.

Worktree exclusivo: `C:/Users/carla58380986/Downloads/SAP-auth-primeiro-acesso`.
Branch: `fix/auth-primeiro-acesso`; HEAD preservado: `7fda4943fa6dba637be5bcb7c871b409ca6831ab`.

## Resultado final

- JUnit: **12 aprovados, 0 falhas, 0 erros, 0 ignorados**. São os 11 cenários de regressão herdados de `FirstAccessAuthenticationTests` e um teste de integração que executa Playwright e verifica o PostgreSQL por SQL.
- Playwright: **2 aprovados**, desktop e celular, com navegador Edge e API real, sem simulação das respostas.
- Gradle: `BUILD SUCCESSFUL`, execução offline, JDK 17.0.20.1. Docker cliente/servidor 29.5.2 e compilador JDK 17 foram confirmados antes de iniciar os serviços. O Java padrão 11 não foi usado.
- PostgreSQL real **16.15**, imagem local `postgres:16-alpine`, sem download.
- `git diff --check` aprovado (apenas avisos de conversão LF/CRLF nos arquivos preexistentes).

Não somar os dois cenários de navegador como testes JUnit adicionais: eles são executados dentro do teste de integração.

## Fluxo integrado validado nos dois dispositivos

1. Administrador fictício autenticado cria o usuário via `POST /auth/register`.
2. Login inicial confirma `senhaTemporaria=true`.
3. Interface recebe a nova senha e executa `PATCH /auth/change-password` com sucesso; painel real é carregado.
4. Botão real de logout limpa token local e cookies `SAP_AUTH`/`SAP_SESSION`; `/auth/me` passa a retornar 401.
5. Senha antiga é recusada com 401.
6. Novo login pela interface com a nova senha chega ao painel, sem solicitar nova troca; `/auth/me` confirma a identidade e `senhaTemporaria=false`.
7. Após os commits das requisições HTTP, leitura independente por `JdbcTemplate` confirma, para os dois usuários, o hash BCrypt persistido, correspondência com a nova senha, ausência de correspondência com a antiga e indicador de senha temporária desativado.

Contas adicionais dos cinco perfis, cookie, token ausente/inválido/expirado, senha atual incorreta, nova senha inválida, conta inativa e proteção dos endpoints também passaram contra PostgreSQL.

## Isolamento

- Banco `auth_disposable`, usuário `auth_fictional`, senha e chave JWT explicitamente fictícias; emails `@example.invalid`.
- Contêiner e rede exclusivos com sufixo aleatório a cada tentativa. Dados em **tmpfs**, sem bind mounts nem volumes persistentes ou anônimos; montagem inspecionada antes dos testes. Nenhum volume existente foi reutilizado.
- Publicação do PostgreSQL somente em `127.0.0.1:55486`. Rede exclusiva com `enable_ip_masquerade=false`. A primeira tentativa com rede `--internal` não permitiu conexão pela porta publicada neste Docker Desktop e foi substituída; não se afirma que a rede final seja um firewall completo.
- Gradle e testes recebem ambiente reconstruído a partir de uma lista de variáveis do Windows necessárias às ferramentas; configurações de aplicação, Spring, banco, proxies e opções Java/Node herdadas não são repassadas.
- Spring carrega exclusivamente `application-auth-postgres.properties`, com JDBC fixado em loopback. Configurações padrão/dev/prod não são carregadas. `DataInitializer` é substituído por mock, impedindo criação da conta predefinida da aplicação.
- Backend vinculado a `127.0.0.1:4187`; Vite em `127.0.0.1:4188`, sem carregar `.env`, com API e todos os destinos de proxy fixados localmente.
- Navegador usa perfil temporário do Playwright, service workers bloqueados, bloqueio de DNS externo, proxy inválido para destinos externos e interceptação que aborta requisições fora da origem local. Fontes externas, quando solicitadas pela página, são abortadas. APIRequestContext recebe somente URLs locais.
- Nenhuma configuração de teste aponta para Supabase, Render, Vercel ou produção; nenhum dado real foi utilizado. Código da aplicação e alterações preexistentes foram preservados nesta etapa.

## Execução e evidências

```powershell
# No worktree indicado, com as portas 4187, 4188 e 55486 livres:
.\run-auth-postgres.ps1
```

O script cria o banco, executa exclusivamente `br.com.sap.PostgresFirstAccessAuthenticationTests` com Gradle offline e encerra os recursos Docker em `finally`. Playwright inicia e encerra Vite; o encerramento do contexto Spring fecha o backend.

Evidências finais:

- `auth-postgres-3311ef9ea4c1.log`: execução aprovada.
- `backend/build/test-results/test/TEST-br.com.sap.PostgresFirstAccessAuthenticationTests.xml`: 12 testes sem falhas; conexão `org.postgresql.jdbc.PgConnection`, versão 16.15.
- `backend/build/reports/tests/test/index.html`: relatório JUnit.
- `frontend/test-results-postgres/.last-run.json`: `passed`, sem testes falhos.

Houve tentativas anteriores com falhas de preparação: chamada Java a método privado, publicação de porta em rede interna, localização automática do Edge e proxy incompleto do painel. Foram corrigidas somente nos arquivos novos de teste; cada repetição utilizou outro banco vazio. A última execução completa passou. `auth-postgres-run.log` é de uma tentativa anterior, não é o resultado final; uma tentativa também encontrou bloqueio desse arquivo, e o script passou a criar logs únicos por execução.

## Encerramento confirmado

Contêiner final `sap-auth-pg-3311ef9ea4c1` e rede `sap-auth-private-3311ef9ea4c1` removidos. Inspeção final não encontrou contêineres/redes de teste nem listeners nas portas **4187, 4188 ou 55486**. Dados tmpfs descartados. Docker Desktop, que já estava disponível, não foi encerrado.

Sem commit, push, merge ou deploy. Nenhuma alteração feita na `main` ou na branch `fix/formularios-validacoes`.
