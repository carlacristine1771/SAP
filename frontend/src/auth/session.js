export const ROLE_ROUTES = {
  administrador: '/painel/admin',
  psicologa: '/painel/psicologo',
  coordenacao: '/painel/coordenacao',
  instrutor: '/painel/instrutor',
};

export function backendRoleToFrontend(role) {
  switch (String(role || '').toUpperCase()) {
    case 'ADMINISTRADOR':
    case 'ADMIN_UNIDADE':
      return 'administrador';
    case 'PSICOLOGO':
      return 'psicologa';
    case 'COORDENACAO':
      return 'coordenacao';
    case 'INSTRUTOR':
      return 'instrutor';
    default:
      return '';
  }
}

export function unitCompatibilityId(id) {
  return id ? `u${id}` : null;
}
