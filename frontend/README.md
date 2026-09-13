# SAP SENAC DF — Frontend React

Frontend do Sistema de Apoio Psicopedagógico, migrado para React 19 e Vite.

## Requisitos

- Node.js 20.19+ ou 22.12+
- Backend Spring Boot disponível em `http://localhost:8080`

## Desenvolvimento

```bash
npm install
npm run dev
```

A aplicação abre em `http://localhost:5173`. Em desenvolvimento, o Vite envia
as chamadas REST ao backend configurado em `VITE_DEV_API_TARGET`.

## Validação

```bash
npm test
npm run test:e2e
npm run build
```

## Configuração da API

Copie `.env.example` para `.env` apenas se precisar mudar os padrões. Em
produção, defina `VITE_API_BASE_URL` quando API e frontend estiverem em origens
diferentes. Como a autenticação usa cookies, o backend deve aceitar credenciais
da origem do frontend.

## Rotas

- `/` — página inicial e autenticação
- `/painel/admin`
- `/painel/admin/:aba`
- `/painel/psicologo`
- `/painel/psicologo/:aba`
- `/painel/coordenacao`
- `/painel/coordenacao/:aba`
- `/painel/instrutor`
- `/painel/instrutor/:aba`

As páginas HTML antigas redirecionam para estas rotas para preservar favoritos.

## Compatibilidade visual

Os painéis são componentes React nativos. Os estilos institucionais preservados
ficam em `public/css`, enquanto as URLs antigas são redirecionadas pelo React
Router para manter a compatibilidade com favoritos existentes.

## Infraestrutura React

- TanStack Query para cache, mutações e atualização automática das listas.
- React Hook Form e Zod para formulários e validações compartilhadas.
- Proteção contra fechamento ou atualização com dados ainda não salvos.
- Paginação no servidor em `/alunos/paginados` e
  `/atendimentos/paginados`.
- Playwright para fluxos completos em desktop e viewport móvel.
