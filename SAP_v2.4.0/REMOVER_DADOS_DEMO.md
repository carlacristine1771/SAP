# Remover Dados de Demonstração do SAP

Este documento explica como remover todos os dados demo do sistema, mantendo apenas o usuário administrador principal.

## Para PostgreSQL (recomendado)

### Opção 1: Usando o script SQL

1. Abra seu cliente PostgreSQL (psql, DBeaver, DataGrip, etc.)

2. Conecte ao banco `sap`:
```sql
\c sap
```

3. Execute o script:
```bash
psql -U postgres -d sap -f LIMPAR_DADOS_DEMO_POSTGRESQL.sql
```

Ou copie e cole o conteúdo do arquivo `LIMPAR_DADOS_DEMO_POSTGRESQL.sql` diretamente no seu cliente.

### Opção 2: Reiniciar do zero (mais rápido)

Se o banco estiver muito poluído, você pode:

1. Deletar o banco:
```sql
DROP DATABASE IF EXISTS sap;
```

2. Recriar vazio:
```sql
CREATE DATABASE sap;
```

3. Rodar o projeto normalmente. O Spring Boot criará as tabelas automaticamente via JPA/Hibernate.

4. O `DataInitializer` criará automaticamente o usuário admin.

## Para MySQL (legado)

Se ainda está usando MySQL:

```bash
mysql -u root -p sap < LIMPAR_DADOS_DEMO_MYSQL.sql
```

## Resultado esperado após limpeza

Após executar um dos métodos acima:

- **Usuarios**: Apenas 1 registro (admin@sap.com)
- **Unidades**: 0 registros
- **Alunos**: 0 registros  
- **Atendimentos**: 0 registros
- **Mensagens**: 0 registros

## Login após limpeza

```
Usuário: admin
Senha: admin123
E-mail: admin@sap.com
```

## O que será mantido

- ✅ Usuário administrador principal
- ✅ Estrutura de tabelas do banco
- ✅ Configurações e índices

## O que será removido

- ❌ Unidades
- ❌ Todos os usuários (exceto admin)
- ❌ Alunos
- ❌ Atendimentos
- ❌ Mensagens

## Restaurar dados após limpeza

Se fizer limpeza acidental, você pode restaurar de um backup:

```bash
# PostgreSQL
pg_restore -U postgres -d sap /caminho/do/backup.sql

# MySQL
mysql -u root -p sap < /caminho/do/backup.sql
```

## Limpeza no frontend (localStorage)

O navegador pode conter dados demo antigos no localStorage. Para limpar:

**Acessar o Console do navegador (F12) e executar:**

```javascript
// Limpar v14
localStorage.removeItem('sap_store_v14_sem_dados_demo');
sessionStorage.removeItem('sap_session_v14_sem_dados_demo');

// Limpar versões antigas
['sap_store_v13_sem_cpf_profissionais','sap_session_v13_sem_cpf_profissionais','sap_store_v12','sap_session_v12','sap_store_v13','sap_session_v13'].forEach(function(k){ localStorage.removeItem(k); sessionStorage.removeItem(k); });

// Recarregar a página
location.reload();
```

## Automático ao iniciar

O `DataInitializer.java` executa automaticamente quando o aplicativo inicia e **cria apenas o admin** se o banco estiver vazio, portanto:

- ✅ Nenhuma configuração manual necessária para criar o admin
- ✅ Dados demo não são criados automaticamente
- ✅ O sistema começa limpo a cada novo banco

## Dúvidas?

Verifique:
- [COMO_RODAR_CORRIGIDO.md](COMO_RODAR_CORRIGIDO.md) — Instruções de execução
- `src/main/java/br/com/sap/config/DataInitializer.java` — Criação automática de dados
