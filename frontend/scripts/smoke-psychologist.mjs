import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const endpoint = process.env.SAP_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const appUrl = process.env.SAP_APP_URL || 'http://127.0.0.1:5173/painel/psicologo';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const now = new Date();
const at = (day, hour) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hour}:00:00`;
const students = [
  { id: 1, nome: 'Ana Carolina Souza', cpf: '123.456.789-00', dataNascimento: '2008-05-10', telefone: '(61) 99999-1111', ativo: true, unidadeId: 1, curso: 'Técnico em Administração', turma: 'ADM 2026', turno: 'MATUTINO', observacoes: 'PCD: Não' },
  { id: 2, nome: 'Bruno Martins Lima', cpf: '987.654.321-00', dataNascimento: '2001-09-18', telefone: '(61) 99999-2222', ativo: true, unidadeId: 1, curso: 'Aprendizagem Profissional', turma: 'AP 2026', turno: 'VESPERTINO', observacoes: 'PCD: Sim' },
];
const appointments = [
  { id: 11, alunoId: 1, aluno: students[0].nome, descricao: 'Acompanhamento acadêmico', dataAtendimento: at(Math.min(now.getDate() + 1, 27), '09:30'), tipoAtendimento: 'dentro', categoriaAtendimento: 'acompanhamento_do_aluno', solicitante: 'Coordenação', psicologo: 'Marina Psicóloga', status: 'PENDENTE', createdAt: at(1, '08:00') },
  { id: 12, alunoId: 2, aluno: students[1].nome, descricao: 'Orientação individual', dataAtendimento: at(Math.max(now.getDate() - 1, 2), '14:00'), tipoAtendimento: 'remoto', categoriaAtendimento: 'atendimento_online', solicitante: 'Instrutor Paulo', psicologo: 'Marina Psicóloga', status: 'FINALIZADO', createdAt: at(1, '09:00') },
];
const pageResponse = (content) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, first: true, last: true });
const events = [{ id: 21, titulo: 'Reunião pedagógica', descricao: 'Alinhamento com a coordenação', tipo: 'REUNIAO', dataInicio: at(Math.min(now.getDate() + 2, 28), '10:00'), dataFim: at(Math.min(now.getDate() + 2, 28), '11:00'), diaInteiro: false, cor: '#1B4E9B', psicologoId: 10, unidadeId: 1 }];
const responses = {
  '/auth/me': { id: 10, nome: 'Marina Psicóloga', tipoUsuario: 'PSICOLOGO', unidadeId: 1, unidade: 'SENAC Taguatinga' },
  '/alunos': students,
  '/alunos/paginados': pageResponse(students),
  '/atendimentos': appointments,
  '/atendimentos/paginados': pageResponse(appointments),
  '/usuarios': [{ id: 30, nome: 'Paulo Instrutor', email: 'paulo@senac.br', tipoUsuario: 'INSTRUTOR', unidade: { id: 1 } }],
  '/chat/mensagens': [],
  '/agenda-eventos': events,
};

let pages;
for (let attempt = 0; attempt < 40; attempt++) {
  try { pages = await fetch(`${endpoint}/json`).then((response) => response.json()); break; } catch { await delay(250); }
}
if (!pages) throw new Error('O navegador não disponibilizou o endpoint CDP.');
const target = pages.find((page) => page.type === 'page');
if (!target) throw new Error('Nenhuma página disponível no endpoint CDP.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const browserErrors = [];
let sequence = 0;
function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject }));
}
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const operation = pending.get(message.id); pending.delete(message.id);
    if (message.error) operation.reject(new Error(message.error.message)); else operation.resolve(message.result);
    return;
  }
  if (message.method === 'Fetch.requestPaused') {
    const path = new URL(message.params.request.url).pathname;
    if (Object.hasOwn(responses, path)) {
      const body = Buffer.from(JSON.stringify(responses[path])).toString('base64');
      void call('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }], body });
    } else void call('Fetch.continueRequest', { requestId: message.params.requestId });
  }
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') browserErrors.push(message.params.entry.text);
});
await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await delay(150); }
  throw new Error(`Tempo esgotado aguardando: ${expression}`);
}

await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable');
await call('Fetch.enable', { patterns: [{ urlPattern: 'http://127.0.0.1:5173/*', requestStage: 'Request' }] });
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url: appUrl });
await waitFor(`Boolean(document.querySelector('.app-shell')) && document.querySelectorAll('.stat-card').length === 4`);
await delay(350);
const summary = await evaluate(`(async()=>{const click=(label)=>[...document.querySelectorAll('.nav-link')].find((item)=>item.textContent.includes(label))?.click();click('Calendário');await new Promise((resolve)=>setTimeout(resolve,100));const tabs=[...document.querySelectorAll('.tab-btn')].map((item)=>item.textContent.trim());[...document.querySelectorAll('.tab-btn')].find((item)=>item.textContent.trim()==='Semana')?.click();await new Promise((resolve)=>setTimeout(resolve,80));return{title:document.querySelector('.topbar-page-title')?.textContent,tabs,weekColumns:document.querySelectorAll('.cal-week-col').length,legacyScripts:[...document.scripts].filter((item)=>/painel-psicologo|app\\.js/.test(item.src)).length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);
await delay(450);
const artifactDirectory = resolve('.artifacts'); mkdirSync(artifactDirectory, { recursive: true });
const desktop = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(artifactDirectory, 'psychologist-desktop.png'), Buffer.from(desktop.data, 'base64'));
await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await delay(250);
const mobileMetrics = await evaluate(`(async()=>{
  const sidebar=document.querySelector('.sidebar');
  const nav=document.querySelector('.sidebar-nav');
  const firstButton=document.querySelector('.nav-link');
  const sidebarRect=sidebar.getBoundingClientRect();
  const firstRect=firstButton.getBoundingClientRect();
  const hit=document.elementFromPoint(firstRect.left+firstRect.width/2,firstRect.top+firstRect.height/2)?.closest('.nav-link');
  const click=(label)=>[...document.querySelectorAll('.nav-link')].find((item)=>item.textContent.includes(label))?.click();
  click('Chat');await new Promise((resolve)=>setTimeout(resolve,100));
  const chatTitle=document.querySelector('.topbar-page-title')?.textContent;
  nav.scrollLeft=nav.scrollWidth;await new Promise((resolve)=>setTimeout(resolve,50));
  const navScrolled=nav.scrollLeft>0;
  click('Calendário');await new Promise((resolve)=>setTimeout(resolve,100));
  return{viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,topbarHeight:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),navVisible:getComputedStyle(sidebar).display!=='none'&&sidebarRect.width>0&&sidebarRect.bottom>0&&sidebarRect.top<innerHeight,navBottom:Math.round(sidebarRect.bottom),viewportHeight:innerHeight,firstItemTouchable:Boolean(hit),navScrollable:nav.scrollWidth>nav.clientWidth,navScrolled,chatTitle,finalTitle:document.querySelector('.topbar-page-title')?.textContent,logoutVisible:getComputedStyle(document.querySelector('.mobile-logout')).display!=='none'}})()`);
const mobile = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(artifactDirectory, 'psychologist-mobile.png'), Buffer.from(mobile.data, 'base64'));
process.stdout.write(`${JSON.stringify({ ...summary, mobileMetrics, browserErrors }, null, 2)}\n`);
await call('Browser.close');
