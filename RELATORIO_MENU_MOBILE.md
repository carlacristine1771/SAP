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

**Nenhuma dessas funções foi alterada.** O botão "Sair" dentro do menu chama a
mesma função `logout` de cada componente. A correção funcional fica para um
commit separado.

### Faixa de 901 a 960px sem navegação (pré-existente)

Medição com dados fictícios no perfil de coordenação:

| Largura | Posição da barra lateral | Margem do conteúdo | Resultado |
| --- | --- | --- | --- |
| 900px | Fora da tela (menu novo fechado) | 0px | Menu lateral mobile |
| 901, 930 e 960px | Fora da tela (`translateX(-230px)`) | 230px | Coluna vazia e nenhuma navegação |
| 961 e 1024px | Visível | 230px | Desktop normal |

Causa: o bloco `@media(max-width:960px)` de `global.css` aplica
`.sidebar{transform:translateX(-100%)}`, e nenhum código adiciona a classe
`.open` que a traria de volta. A regra não foi alterada nesta etapa; a correção
aguarda decisão.

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

## Pendências

1. Commit separado com a correção do logout de Coordenação e Instrutor e a
   remoção do `alert` e do `console.log`, com ajuste de `session-diagnosis.spec.ts`.
2. Decidir a correção da faixa de 901 a 960px.
3. Responsividade de formulários, modais, cards, tabelas, gráficos e calendários.
4. Atualizar os scripts manuais `scripts/audit-mobile-panels.mjs` e
   `scripts/smoke-psychologist.mjs`, que ainda procuram `.mobile-logout`.
5. As regras antigas da barra inferior e de `.mobile-logout` continuam em
   `global.css` e podem ser removidas depois.
6. Unificar os três componentes de painel.
7. Revisar as falhas pré-existentes de `panels.spec.ts` (origens dos mocks) e de
   `permissions.p0.spec.ts:251`.
