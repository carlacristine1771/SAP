export function extractBody(html) {
  if (typeof html !== 'string') return '';
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
}

export function legacyAssetUrl(path) {
  return path.startsWith('/') ? path : `/${path}`;
}
