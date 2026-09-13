import LegacyDocument from '../components/LegacyDocument.jsx';
import landingHtml from '../legacy/landing.html?raw';

const landingStyles = ['/css/index.css'];
const landingScripts = ['/js/app.js', '/js/index.js'];

export default function LandingPage() {
  return (
    <LegacyDocument
      html={landingHtml}
      title="SAP SENAC DF — Sistema de Apoio Psicopedagógico"
      styles={landingStyles}
      scripts={landingScripts}
    />
  );
}
