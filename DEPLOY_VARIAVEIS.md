# Variáveis de ambiente para o deploy

Valores reais nunca entram no repositório. Configure-os apenas nos painéis do
Render e da Vercel.

## Render (backend)

| Variável | Obrigatória | Observação |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | sim | `prod`. Sem ela o perfil `dev` é ativado. |
| `DB_URL` | sim | URL JDBC do PostgreSQL com `sslmode=require`. |
| `DB_USERNAME` | sim | |
| `DB_PASSWORD` | sim | |
| `JWT_SECRET` | sim | 32 caracteres ou mais. |
| `SAP_CORS_ALLOWED_ORIGINS` | sim | Origens exatas do frontend, separadas por vírgula e sem barra final (ex.: `https://<projeto>.vercel.app`). Curingas são recusados. |
| `SAP_CHAT_SECRET` | sim | Chave das mensagens do chat. Vazia ou igual à chave padrão antiga impede a inicialização. Mantenha o mesmo valor entre deploys: trocá-la torna ilegíveis as mensagens já gravadas. |
| `JWT_EXPIRATION` | não | Padrão `86400000` (24 h). |
| `PORT` | não | Definida pelo Render. |
| `SAP_BOOTSTRAP_ADMIN_ENABLED` | não | Ausente ou `false`. Use `true` só para criar o primeiro administrador, com `SAP_BOOTSTRAP_ADMIN_EMAIL`, `_USUARIO`, `_SENHA` (12+ caracteres) e, opcionalmente, `_NOME`; desabilite e remova a senha em seguida. |

Sem uma variável obrigatória a aplicação não inicia.

## Vercel (frontend)

| Variável | Obrigatória | Observação |
|---|---|---|
| `VITE_API_BASE_URL` | recomendada | URL do backend no Render, sem barra final. Sem ela o build usa `https://sap-backend-rvek.onrender.com`. |

A origem em que a Vercel publica o frontend precisa constar em
`SAP_CORS_ALLOWED_ORIGINS` no Render. URLs de preview e domínios próprios só
funcionam se forem listados.
