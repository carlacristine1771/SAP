-- Limpeza completa dos dados de demonstração do SAP.
-- Mantém somente o login principal de administrador.
-- Login: admin | E-mail: admin@sap.com | Senha: admin123

USE sap;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM atendimentos;
DELETE FROM alunos;
DELETE FROM usuarios WHERE email <> 'admin@sap.com' AND usuario <> 'admin';
DELETE FROM unidades;

SET FOREIGN_KEY_CHECKS = 1;

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

UPDATE usuarios
SET
  nome = 'Administrador Principal',
  email = 'admin@sap.com',
  usuario = 'admin',
  tipo_usuario = 'ADMINISTRADOR',
  ativo = true,
  unidade_id = NULL
WHERE email = 'admin@sap.com' OR usuario = 'admin';
