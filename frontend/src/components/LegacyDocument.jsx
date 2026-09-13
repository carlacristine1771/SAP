import { useEffect, useMemo, useState } from 'react';
import { configureLegacyRuntime } from '../config/runtime.js';
import { extractBody, legacyAssetUrl } from '../utils/legacyDocument.js';

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = legacyAssetUrl(src);
    script.async = false;
    script.dataset.sapLegacy = 'true';
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
    document.body.appendChild(script);
  });
}

/**
 * Ponte isolada para as regras de tela existentes.
 * React controla rota, montagem e descarte, enquanto o DOM e os estilos
 * originais permanecem inalterados durante a componentização gradual.
 */
export default function LegacyDocument({ html, title, styles = [], scripts = [] }) {
  const markup = useMemo(() => extractBody(html), [html]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    document.title = title;
    configureLegacyRuntime();
    const loadedScripts = [];

    async function initialize() {
      try {
        for (const src of scripts) {
          if (cancelled) return;
          const script = await loadClassicScript(src);
          loadedScripts.push(script);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    }

    initialize();
    return () => {
      cancelled = true;
      loadedScripts.forEach((script) => script.remove());
    };
  }, [scripts, title]);

  return (
    <>
      {styles.map((href) => (
        <link key={href} rel="stylesheet" href={legacyAssetUrl(href)} />
      ))}
      {loadError ? (
        <div role="alert" className="sap-load-error">
          {loadError} Atualize a página para tentar novamente.
        </div>
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
