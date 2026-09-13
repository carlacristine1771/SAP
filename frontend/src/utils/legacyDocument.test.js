import { describe, expect, it } from 'vitest';
import { extractBody, legacyAssetUrl } from './legacyDocument.js';

describe('extractBody', () => {
  it('mantém o conteúdo visual e remove scripts clássicos', () => {
    const html = '<html><body><main id="painel">SAP</main><script src="app.js"></script></body></html>';
    expect(extractBody(html)).toBe('<main id="painel">SAP</main>');
  });

  it('aceita fragmentos de HTML', () => {
    expect(extractBody('<section>Conteúdo</section>')).toBe('<section>Conteúdo</section>');
  });
});

describe('legacyAssetUrl', () => {
  it('normaliza caminhos públicos', () => {
    expect(legacyAssetUrl('js/app.js')).toBe('/js/app.js');
    expect(legacyAssetUrl('/css/global.css')).toBe('/css/global.css');
  });
});
