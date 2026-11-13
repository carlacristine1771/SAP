# Menu lateral mobile dos painéis — primeiro conjunto de alterações

Registro técnico da primeira etapa da revisão de responsividade mobile do SAP,
para posterior inclusão na documentação do Projeto Integrador.

- Branch: `feat/mobile-menu-responsivo-final`, criada em 13/11/2026 a partir de
  `fe77bf2` (`origin/main`), sem upstream configurado.
- Situação: alterações locais, **sem commit, push, merge ou deploy**.
- Fora do escopo e não alterados: backend, Supabase, Render, Vercel, variáveis
  de ambiente, autenticação e regras de negócio.

## Objetivo desta etapa

Substituir, somente até 900px de largura, a barra inferior com rolagem horizontal
por um menu lateral que desliza da esquerda, com:

- botão de menu no canto superior esquerdo;
- botão de tema claro/escuro no canto superior direito;
- opção "Sair" dentro do menu;
- os itens de navegação de cada perfil: administrador geral, administrador de
  unidade, coordenação, instrutor e psicóloga;
- desktop sem nenhuma alteração visual.

Formulários, modais, tabelas, gráficos e calendários ficam para as próximas etapas.

## Análise anterior à alteração

- A navegação está em três componentes com estrutura repetida:
  `PanelShell.jsx` (administradores), `OperationalShell.jsx` (coordenação e
  instrutor) e `PsychologistShell.jsx` (psicologia). Os itens de cada perfil já
  são definidos nesses componentes; o administrador de unidade não recebe
  "Unidades" e só a coordenação recebe "Cursos e Turmas" e "Instrutores".
- Em `public/css/global.css`, o bloco `@media (max-width: 900px)` transforma a
  barra lateral em barra inferior de 72px com rolagem horizontal. Em 390px, os
  itens além do quarto exigiam arrastar a barra.
- O hook existente `useModalFocus.ts` já oferecia foco inicial, Tab circular,
  Escape, devolução do foco e bloqueio de rolagem. Ele foi reaproveitado.

## Problemas identificados e não corrigidos nesta etapa

### Logout de Coordenação e Instrutor (documentado antes da alteração)

Em `fe77bf2`, `OperationalShell.jsx`, função `logout`:

1. não chama `POST /auth/logout`, então os cookies `SAP_AUTH` e `SAP_SESSION`
   não são expirados pelo servidor;
2. exibe `alert("O botão de logout foi acionado!")`, uma mensagem de depuração;
3. apenas remove `sap_token` do `localStorage` e redireciona para `/?logout=1`.

O teste `e2e/session-diagnosis.spec.ts` registra esse comportamento: espera zero
chamadas de logout e a permanência dos cookies.

Em `PanelShell.jsx`, a função `logout` também contém
`console.log("LOGOUT FOI CLICADO")`.

**Nenhuma dessas funções foi alterada no primeiro commit.** O botão "Sair"
dentro do menu chama a mesma função `logout` de cada componente. A correção
está na seção "Terceira etapa".

### Faixa de 901 a 960px sem navegação (pré-existente)

Medição com dados fictícios no perfil de coordenação:

| Largura | Posição da barra lateral | Margem do conteúdo | Resultado |
| --- | --- | --- | --- |
| 900px | Fora da tela (menu novo fechado) | 0px | Menu lateral mobile |
| 901, 930 e 960px | Fora da tela (`translateX(-230px)`) | 230px | Coluna vazia e nenhuma navegação |
| 961 e 1024px | Visível | 230px | Desktop normal |

Causa: o bloco `@media(max-width:960px)` de `global.css` aplica
`.sidebar{transform:translateX(-100%)}`, e nenhum código adiciona a classe
`.open` que a traria de volta. A regra não foi alterada no primeiro commit; a
correção está na seção "Segunda etapa".

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `frontend/src/hooks/useMobileMenu.ts` (novo) | Estado de abertura do menu; fecha ao passar para largura desktop; usa `useModalFocus` |
| `frontend/src/components/panel/MobileMenu.jsx` (novo) | Botão de abrir, botão de fechar, fundo escurecido e atributos do menu, compartilhados pelos três componentes |
| `frontend/public/css/mobile-nav.css` (novo) | Regras do menu lateral e do cabeçalho mobile, todas em `@media (max-width: 900px)`. Fora da media query, apenas esconde os controles novos |
| `frontend/src/components/panel/PanelShell.jsx` | Usa o menu mobile; fecha o menu ao navegar; texto "Sair" no botão do rodapé (oculto no desktop); remove o botão `.mobile-logout` da barra superior e o efeito que centralizava o item ativo na barra inferior |
| `frontend/src/components/panel/OperationalShell.jsx` | As mesmas alterações |
| `frontend/src/components/panel/PsychologistShell.jsx` | As mesmas alterações |
| `frontend/src/components/panel/Icon.jsx` | Ícone `menu` |
| `frontend/e2e/mobile-menu.spec.ts` (novo) | Testes do menu nos cinco perfis e do desktop |
| `frontend/e2e/panels.spec.ts` | No celular, abre o menu antes de clicar nos itens de navegação |
| `frontend/e2e/session-diagnosis.spec.ts` | No celular, abre o menu antes de clicar em "Sair"; expectativas mantidas |
| `frontend/e2e/first-access.spec.ts` | No celular, abre o menu antes de clicar em "Sair"; expectativas mantidas |

Nenhuma dependência nova foi adicionada. `global.css` não foi editado.

## Acessibilidade

- Botão de menu com `aria-label="Abrir menu"`, `aria-controls` e `aria-expanded`.
- Menu aberto com `role="dialog"`, `aria-modal="true"` e nome "Menu do painel";
  esses atributos não existem no desktop.
- Ao abrir, o foco vai para "Fechar menu"; Tab e Shift+Tab ficam dentro do menu;
  Escape, o botão de fechar, o toque fora do menu e a navegação fecham o menu e
  devolvem o foco ao botão de menu.
- Menu fechado com `visibility: hidden`: os itens saem da navegação por teclado
  e da árvore de acessibilidade.
- Alvos de toque de 42 a 48px; animação desligada com `prefers-reduced-motion`.

## Testes executados

Ambiente: Windows, Node 24.16.0, JDK 17.0.20.1, Microsoft Edge (Playwright 1.63.0).
Todos os testes de navegador usaram dados fictícios e API simulada. Nenhum
serviço externo foi acessado.

### Antes (`fe77bf2`) e depois

| Verificação | Antes | Depois |
| --- | --- | --- |
| Backend `gradlew test` (H2) | 527 testes, 0 falhas, 31 ignorados | 527 testes, 0 falhas, 31 ignorados |
| `npm test` (Vitest) | 54/54 aprovados | 54/54 aprovados |
| `npm run typecheck` | Aprovado | Aprovado |
| `npm run build` | Aprovado | Aprovado |
| Playwright, configuração padrão | 64 aprovados, 31 falhas, 1 ignorado | 89 aprovados, 31 falhas, 26 ignorados |
| Playwright, padrão com API local¹ | 69 aprovados, 26 falhas, 1 ignorado | 94 aprovados, 26 falhas, 26 ignorados |
| Playwright, `playwright.p0.config.ts` | 22 aprovados, 7 falhas, 1 ignorado | 22 aprovados, 7 falhas, 1 ignorado |
| Playwright, `playwright.auth.config.ts` | Não executado separadamente² | 6/6 aprovados |

¹ `VITE_API_BASE_URL=http://127.0.0.1:4174` definido apenas no processo do teste,
porque, sem essa variável, `src/config/runtime.ts` usa a URL do Render e os
mocks de `panels.spec.ts` bloqueiam essa origem.

² Os mesmos casos de `first-access.spec.ts` rodam dentro de `playwright.p0.config.ts`
e passaram antes e depois.

Os 25 aprovados a mais e os 25 ignorados a mais são do novo `mobile-menu.spec.ts`:
cada caso roda só no projeto correspondente (celular ou desktop).

### Falhas anteriores à alteração (não são regressões)

As falhas são as mesmas, nos mesmos arquivos e projetos, antes e depois:

| Falha | Causa |
| --- | --- |
| `first-access.spec.ts` e `permissions.p0.spec.ts` na configuração padrão | Escritos para o servidor isolado da porta 4186; bloqueiam a porta 4174 |
| `first-access.postgres.spec.ts` | Exige PostgreSQL descartável em Docker; não executado nesta etapa |
| `panels.spec.ts` na configuração padrão sem API local | A API aponta para o Render, e o mock bloqueia essa origem |
| `panels.spec.ts` em `playwright.p0.config.ts` | O mock aceita só a origem 4174 e bloqueia a página servida na 4186 |
| `permissions.p0.spec.ts:251` (desktop e celular) | O teste procura um campo com placeholder "E-mail" que não é encontrado no formulário de instrutor |

### Regressão encontrada e resolvida durante a etapa

Na primeira execução posterior, `first-access.spec.ts` falhou no celular, porque
procurava o botão "Sair" que antes ficava na barra superior. O teste passou a
abrir o menu antes de clicar em "Sair", e a verificação do logout continuou a
mesma. A primeira versão do ajuste verificava a visibilidade do botão de menu
antes do fim da renderização do painel; a versão final decide pela largura da
tela.

### Novo teste: `e2e/mobile-menu.spec.ts`

- Cinco perfis em 390px: posição do botão de menu e do botão de tema; menu
  fechado fora da tela; itens exatamente iguais aos do perfil; "Sair" visível no
  menu; foco inicial; Tab preso no menu; Escape; toque fora; navegação com troca
  de URL e de título.
- Larguras de 320, 375, 390, 430 e 768px, nos dois temas, para os cinco perfis:
  nenhuma rolagem horizontal, com o menu fechado e aberto, e menu dentro da tela.
- Desktop em 1280 e 1440px, para os cinco perfis: sem botão de menu, sem fundo
  escurecido, sem `aria-modal`, barra lateral visível em x=0, os mesmos itens e
  "Sair" visível.

Resultado: 25 aprovados.

### Comparação visual do desktop

Capturas de página inteira de `fe77bf2` comparadas com as de depois, com
tolerância de 0 pixel: cinco perfis, duas telas por perfil, temas claro e
escuro, larguras de 1024, 1280 e 1440px.

Resultado: **60 de 60 idênticas**. As referências foram gravadas duas vezes
antes da alteração, para confirmar que a captura é estável.

Também foram registradas 50 capturas de celular antes e 100 depois (com o menu
fechado e aberto), nos cinco perfis, dois temas e cinco larguras.

## Limitações

- As evidências (logs e capturas) estão em uma pasta temporária local, fora do
  repositório. Não foram versionadas.
- Os testes de navegador usam API simulada; não houve teste contra o backend
  real nem em aparelhos físicos.
- O `mobile-nav.css` é carregado pelo próprio componente, como os demais estilos
  dos painéis. Antes de o arquivo carregar, pode aparecer por um instante o
  layout anterior.
- O Prettier acusa formatação nos três componentes e em `Icon.jsx`; o
  `PanelShell.jsx` de `fe77bf2` já falhava nessa verificação. Os arquivos não
  foram reformatados, para não alterar as funções de logout.

## Segunda etapa: barra lateral entre 901 e 960px

Decisão: manter a barra lateral desktop visível nessa faixa, sem estender o
breakpoint do menu mobile, que continua em 900px.

### Alteração

| Arquivo | Alteração |
| --- | --- |
| `frontend/public/css/global.css` | Remove do bloco `@media(max-width:960px)` as regras `.sidebar{transform:translateX(-100%)}` e `.sidebar.open{transform:translateX(0)}`. A segunda nunca era ativada, porque nenhum código adiciona `.open` |
| `frontend/e2e/mobile-menu.spec.ts` | Os testes de desktop passam a incluir 930px |

Até 900px, a posição da barra já era definida por regras com `!important` (em
`global.css` e em `mobile-nav.css`), que não dependiam das regras removidas.

### Comparação visual ao redor do breakpoint

Referências gravadas no commit `4d2e155`, antes da correção, e conferidas duas
vezes: cinco perfis, temas claro e escuro, larguras de 880, 900, 901, 920, 940,
960, 961 e 980px (80 capturas, tolerância de 0 pixel).

| Larguras | Capturas idênticas depois da correção | Barra lateral depois | Início do conteúdo |
| --- | --- | --- | --- |
| 880 e 900px | 20 de 20 | Menu mobile fechado | 0px |
| 901, 920, 940 e 960px | 0 de 40 (mudança esperada) | Visível, de 0 a 230px | 230px |
| 961 e 980px | 20 de 20 | Visível, de 0 a 230px | 230px |

Em nenhuma largura houve rolagem horizontal. Antes da correção, nas larguras de
901 a 960px, a barra ficava em −230px e o conteúdo começava em 230px.

### Testes depois da correção

| Verificação | Resultado |
| --- | --- |
| Comparação visual do desktop (1024, 1280 e 1440px) | 60 de 60 idênticas a `fe77bf2` |
| `npm test` | 54/54 aprovados |
| `npm run typecheck` e `npm run build` | Aprovados |
| Playwright, padrão com API local | 99 aprovados, 26 falhas (as mesmas pré-existentes), 31 ignorados |
| Playwright, `playwright.p0.config.ts` | 22 aprovados, 7 falhas (as mesmas pré-existentes), 1 ignorado |

Os 5 aprovados a mais são os testes de desktop em 930px.

## Terceira etapa: logout de Coordenação e Instrutor

Correção funcional, separada das mudanças visuais. Nenhum arquivo de backend ou
de autenticação do servidor foi alterado.

### Alteração

| Arquivo | Alteração |
| --- | --- |
| `frontend/src/components/panel/OperationalShell.jsx` | `logout` passa a chamar `POST /auth/logout`, como os painéis de administração, antes de remover `sap_token` e voltar à página inicial. O `alert` de depuração foi removido. Se a chamada falhar, o erro é registrado no console e a saída local continua |
| `frontend/src/components/panel/PanelShell.jsx` | Remove o `console.log("LOGOUT FOI CLICADO")` e corrige a indentação da função; o comportamento não muda |
| `frontend/e2e/session-diagnosis.spec.ts` | O teste que registrava o defeito (zero chamadas de logout) foi substituído por cinco testes, um por perfil |

O painel da Psicologia não foi alterado. Foram mantidos dois `console.error`
que registram falhas reais: o da chamada de logout e o de `AppErrorBoundary`.

### Verificação por perfil

Para administrador geral, administrador de unidade, coordenação, instrutor e
psicóloga, em desktop e celular, o teste confirma que o botão Sair:

- faz exatamente uma chamada a `/auth/logout`;
- remove `sap_token`, também na outra aba aberta;
- volta para a página inicial;
- não abre nenhum diálogo (`alert`, `confirm` ou `prompt`).

Antes da correção, o teste anterior afirmava zero chamadas a `/auth/logout` para
a Coordenação e passava em todas as execuções. A API é simulada, então a
expiração efetiva dos cookies pelo servidor não foi verificada nesses testes.

### Testes depois da correção

| Verificação | Resultado |
| --- | --- |
| `e2e/session-diagnosis.spec.ts` | 14 aprovados (2 casos de abas e 5 de logout, em desktop e celular) |
| `playwright.auth.config.ts` (primeiro acesso, logout e novo login) | 6/6 aprovados |
| `playwright.p0.config.ts` | 22 aprovados, 7 falhas (as mesmas pré-existentes), 1 ignorado |
| Playwright, padrão com API local | 107 aprovados, 26 falhas (as mesmas pré-existentes), 31 ignorados |
| Playwright, configuração padrão | 102 aprovados, 31 falhas (as mesmas pré-existentes), 31 ignorados |
| `npm test`, `npm run typecheck` e `npm run build` | 54/54 aprovados; tipos e build aprovados |
| Comparação visual do desktop | 60 de 60 idênticas a `fe77bf2` |

Os 8 aprovados a mais nas rodadas padrão vêm da troca de um caso de logout
(Coordenação) por cinco, nos dois projetos.

## Pendências

1. Responsividade de formulários, modais, cards, tabelas, gráficos e calendários.
2. Atualizar os scripts manuais `scripts/audit-mobile-panels.mjs` e
   `scripts/smoke-psychologist.mjs`, que ainda procuram `.mobile-logout`.
3. As regras antigas da barra inferior e de `.mobile-logout` continuam em
   `global.css` e podem ser removidas depois.
4. Unificar os três componentes de painel e a função de logout, hoje repetida.
5. Validar o logout contra o backend real, incluindo a expiração dos cookies.
6. Revisar as falhas pré-existentes de `panels.spec.ts` (origens dos mocks) e de
   `permissions.p0.spec.ts:251`.
