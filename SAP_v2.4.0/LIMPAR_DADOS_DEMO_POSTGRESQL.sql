-- Limpeza completa dos dados de demonstração do SAP para PostgreSQL.
-- Mantém somente o login principal de administrador.
-- Login: admin | E-mail: admin@sap.com | Senha: admin123

-- Conectar ao banco 'sap'
\c sap

-- Desabilitar constraints temporariamente
ALTER TABLE IF EXISTS atendimentos DISABLE TRIGGER ALL;
ALTER TABLE IF EXISTS alunos DISABLE TRIGGER ALL;
ALTER TABLE IF EXISTS usuarios DISABLE TRIGGER ALL;
ALTER TABLE IF EXISTS unidades DISABLE TRIGGER ALL;

-- Limpar tabelas
DELETE FROM atendimentos;
DELETE FROM alunos;
DELETE FROM usuarios WHERE email != 'admin@sap.com' AND usuario != 'admin';
DELETE FROM unidades;

-- Reabilitar constraints
ALTER TABLE IF EXISTS atendimentos ENABLE TRIGGER ALL;
ALTER TABLE IF EXISTS alunos ENABLE TRIGGER ALL;
ALTER TABLE IF EXISTS usuarios ENABLE TRIGGER ALL;
ALTER TABLE IF EXISTS unidades ENABLE TRIGGER ALL;

-- Garantir que o admin principal existe (se a tabela estava vazia)
INSERT INTO usuarios (nome, email, usuario, senha, tipo_usuario, ativo, unidade_id, created_at)
SELECT
  'Administrador Principal',
  'admin@sap.com',
  'admin',
  '$2a$10$D9OOHhTjTHEN0PcUHF96JeQ7GdC9VP7mvOzJVy2eVzS3jzr/dFyZm',
  'ADMINISTRADOR',
  true,
  NULL,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'admin@sap.com' OR usuario = 'admin'
);

-- Atualizar o admin se ele existir (garantir dados corretos)
UPDATE usuarios
SET
  nome = 'Administrador Principal',
  email = 'admin@sap.com',
  usuario = 'admin',
  tipo_usuario = 'ADMINISTRADOR',
  ativo = true,
  unidade_id = NULL
WHERE email = 'admin@sap.com' OR usuario = 'admin';

-- Confirmar as mudanças
COMMIT;

-- Exibir resultado
SELECT COUNT(*) as total_usuarios FROM usuarios;
SELECT COUNT(*) as total_unidades FROM unidades;
SELECT COUNT(*) as total_alunos FROM alunos;
SELECT COUNT(*) as total_atendimentos FROM atendimentos;
