import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const endpoint = process.env.SAP_CDP_ENDPOINT || 'http://127.0.0.1:9222';
const appUrl = process.env.SAP_APP_URL || 'http://127.0.0.1:5173';
const username = process.env.SAP_SMOKE_USER;
const password = process.env.SAP_SMOKE_PASSWORD;
if (!username || !password) throw new Error('Defina SAP_SMOKE_USER e SAP_SMOKE_PASSWORD.');

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
let pages;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    pages = await fetch(`${endpoint}/json`).then((response) => response.json());
    break;
  } catch {
    await delay(250);
  }
}
if (!pages) throw new Error('O navegador não disponibilizou o endpoint CDP.');
const target = pages.find((page) => page.type === 'page');
if (!target) throw new Error('Nenhuma página disponível no endpoint CDP.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const events = [];
let sequence = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve: resolveCall, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolveCall(message.result);
  } else if (message.method === 'Runtime.exceptionThrown' || message.method === 'Log.entryAdded') {
    events.push(message);
  }
});
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject }));
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(150);
  }
  throw new Error(`Tempo esgotado aguardando: ${expression}`);
}

await call('Runtime.enable');
await call('Log.enable');
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url: appUrl });
await waitFor(`document.querySelectorAll('.role-card').length === 4`);
await evaluate(`fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:${JSON.stringify(username)},senha:${JSON.stringify(password)}})}).then(async r=>{if(!r.ok)throw new Error(await r.text());location.assign('/painel/admin')})`);
await waitFor(`location.pathname === '/painel/admin' && Boolean(document.querySelector('.app-shell'))`);
await delay(600);

const result = await evaluate(`(async()=>{
  const click = (label) => [...document.querySelectorAll('.nav-link')].find(el=>el.textContent.includes(label))?.click();
  const summary = {
    title: document.title,
    legacyScripts: [...document.scripts].filter(el=>/painel-admin|sap-chat-global|app\\.js/.test(el.src)).length,
    stats: [...document.querySelectorAll('.stat-value')].map(el=>el.textContent),
    canvasCount: document.querySelectorAll('canvas').length,
    sidebarItems: [...document.querySelectorAll('.nav-label')].map(el=>el.textContent.trim()),
  };
  click('Usuários'); await new Promise(r=>setTimeout(r,100));
  summary.usersPanel = document.querySelector('.topbar-page-title')?.textContent;
  summary.userRows = document.querySelectorAll('tbody tr').length;
  click('Criar Login'); await new Promise(r=>setTimeout(r,100));
  summary.createPanel = document.querySelector('.topbar-page-title')?.textContent;
  summary.roleOptions = document.querySelectorAll('.role-option').length;
  click('Unidades'); await new Promise(r=>setTimeout(r,100));
  document.querySelector('.admin-blue-btn')?.click(); await new Promise(r=>setTimeout(r,100));
  summary.unitModal = document.querySelector('.modal-overlay.open')?.getAttribute('aria-label');
  document.querySelector('.modal-overlay.open .modal-close-plain')?.click();
  document.querySelector('.btn-theme')?.click();
  summary.theme = document.documentElement.dataset.theme;
  click('Dashboard'); await new Promise(r=>setTimeout(r,100));
  return summary;
})()`);

const artifactDirectory = resolve('.artifacts');
mkdirSync(artifactDirectory, { recursive: true });
await delay(250);
const desktop = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(artifactDirectory, 'admin-desktop.png'), Buffer.from(desktop.data, 'base64'));
await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await delay(350);
const mobileMetrics = await evaluate(`({viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,sidebarHeight:Math.round(document.querySelector('.sidebar').getBoundingClientRect().height),topbarHeight:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),topbarLeftWidth:Math.round(document.querySelector('.topbar-left').getBoundingClientRect().width),titleWidth:Math.round(document.querySelector('.topbar-page-title').getBoundingClientRect().width),topbarRightHeight:Math.round(document.querySelector('.topbar-right').getBoundingClientRect().height),navVisible:getComputedStyle(document.querySelector('.sidebar')).display !== 'none'})`);
const mobile = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(artifactDirectory, 'admin-mobile.png'), Buffer.from(mobile.data, 'base64'));

const browserErrors = events.map((event) => event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || event.params?.entry?.text || event.method);
process.stdout.write(`${JSON.stringify({ ...result, mobileMetrics, browserErrors }, null, 2)}\n`);
await call('Browser.close');
