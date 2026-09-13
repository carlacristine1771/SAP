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
- `/painel/psicologo`
- `/painel/coordenacao`
- `/painel/instrutor`

As páginas HTML antigas redirecionam para estas rotas para preservar favoritos.

## Compatibilidade visual

Os painéis são componentes React nativos. Os estilos institucionais preservados
ficam em `public/css`, enquanto as URLs antigas são redirecionadas pelo React
Router para manter a compatibilidade com favoritos existentes.
