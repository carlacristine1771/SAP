# Revisão SAP - login de profissionais sem CPF

Esta versão foi revisada conforme a documentação do SAP.

## Entendimento do sistema

O SAP é o Serviço de Apoio Psicopedagógico. O sistema atende profissionais da instituição, especialmente administrador, coordenação, psicólogo(a) e instrutor.

Funcionalidades principais:

- login de profissionais;
- cadastro e acompanhamento de alunos;
- encaminhamento de alunos;
- gerenciamento/agendamento de atendimentos;
- dashboards por perfil;
- chat interno;
- troca de tema claro/escuro.

## Correção importante

O login/cadastro de profissional NÃO é por CPF.

O CPF fica relacionado aos alunos quando necessário, não ao login dos profissionais.

## Login inicial

Usuário: admin
Senha: admin123

Também é possível entrar com:
E-mail: admin@sap.com
Senha: admin123

## Banco MySQL

Crie o banco antes de rodar:

```sql
CREATE DATABASE IF NOT EXISTS sap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

O projeto usa por padrão:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/sap?useSSL=false&serverTimezone=America/Sao_Paulo&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=
```

Se o seu MySQL tiver senha, defina a variável DB_PASSWORD ou altere o application-dev.properties.
