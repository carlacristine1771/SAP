import { Navigate, useParams } from 'react-router-dom';
import LegacyDocument from '../components/LegacyDocument.jsx';
import adminHtml from '../legacy/painel-admin.html?raw';
import coordenacaoHtml from '../legacy/painel-coordenacao.html?raw';
import instrutorHtml from '../legacy/painel-instrutor.html?raw';
import psicologoHtml from '../legacy/painel-psicologo.html?raw';

const sharedStyles = ['/css/global.css', '/css/painel.css'];
const sharedScripts = ['/js/app.js', '/js/theme-chat.js'];

const panels = {
  admin: {
    html: adminHtml,
    title: 'Painel Administrador — SAP SENAC DF',
    stylesheet: '/css/painel-admin.css',
    scripts: [...sharedScripts, '/js/painel-admin.js', '/js/sap-chat-global.js'],
  },
  coordenacao: {
    html: coordenacaoHtml,
    title: 'Painel Coordenação — SAP SENAC CEP',
    stylesheet: '/css/painel-coordenacao.css',
    scripts: [...sharedScripts, '/js/painel-coordenacao.js', '/js/sap-chat-global.js'],
  },
  instrutor: {
    html: instrutorHtml,
    title: 'Painel Instrutor — SAP SENAC CEP',
    stylesheet: '/css/painel-instrutor.css',
    scripts: [...sharedScripts, '/js/painel-instrutor.js', '/js/sap-chat-global.js'],
  },
  psicologo: {
    html: psicologoHtml,
    title: 'Painel Psicólogo(a) — SAP SENAC CEP',
    stylesheet: '/css/painel-psicologo.css',
    scripts: [...sharedScripts, '/js/painel-psicologo.js'],
  },
};

export default function PanelPage() {
  const { role } = useParams();
  const panel = panels[role];
  if (!panel) return <Navigate to="/" replace />;

  return (
    <LegacyDocument
      html={panel.html}
      title={panel.title}
      styles={[...sharedStyles, panel.stylesheet]}
      scripts={panel.scripts}
    />
  );
}
