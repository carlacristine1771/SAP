import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const endpoint = process.env.SAP_CDP_ENDPOINT || "http://127.0.0.1:9227";
const appOrigin = process.env.SAP_APP_ORIGIN || "http://127.0.0.1:5173";
const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const allProfiles = [
  {
    key: "admin",
    backendRole: "ADMINISTRADOR",
    path: "/painel/admin",
    labels: ["Dashboard", "Unidades", "Usuários", "Criar Login", "Chat"],
  },
  {
    key: "coordenacao",
    backendRole: "COORDENACAO",
    path: "/painel/coordenacao",
    labels: ["Início", "Alunos", "Cursos e Turmas", "Atendimentos", "Chat"],
  },
  {
    key: "instrutor",
    backendRole: "INSTRUTOR",
    path: "/painel/instrutor",
    labels: ["Início", "Alunos", "Atendimentos", "Chat"],
  },
  {
    key: "psicologo",
    backendRole: "PSICOLOGO",
    path: "/painel/psicologo",
    labels: [
      "Dashboard",
      "Indicativos",
      "Histórico",
      "Atendimentos",
      "Alunos",
      "Calendário",
      "Chat",
    ],
  },
];
const requestedProfiles = (process.env.SAP_AUDIT_PROFILES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const profiles = requestedProfiles.length
  ? allProfiles.filter((profile) => requestedProfiles.includes(profile.key))
  : allProfiles;
const auditWidths = (process.env.SAP_AUDIT_WIDTHS || "320,390,430")
  .split(",")
  .map(Number)
  .filter((value) => Number.isFinite(value) && value >= 280);
const requestedDetailLabel = process.env.SAP_AUDIT_DETAIL_LABEL?.trim();

const students = [
  {
    id: 1,
    nome: "Ana Carolina Souza",
    cpf: "123.456.789-00",
    dataNascimento: "2007-05-10",
    telefone: "(61) 99999-1111",
    ativo: true,
    unidadeId: 1,
    cursoId: 1,
    turmaId: 1,
    curso: "Técnico em Administração",
    turma: "ADM 2026",
    turno: "MATUTINO",
    observacoes: "PCD: Não",
  },
  {
    id: 2,
    nome: "Bruno Martins Lima",
    cpf: "987.654.321-00",
    dataNascimento: "2000-09-18",
    telefone: "(61) 99999-2222",
    ativo: true,
    unidadeId: 1,
    cursoId: 2,
    turmaId: 2,
    curso: "Aprendizagem Profissional",
    turma: "AP 2026",
    turno: "VESPERTINO",
    observacoes: "PCD: Sim",
  },
];
const currentDate = new Date();
const dateTime = new Date(
  currentDate.getFullYear(),
  currentDate.getMonth(),
  Math.min(currentDate.getDate() + 1, 28),
  9,
  30,
).toISOString();
const appointments = [
  {
    id: 11,
    alunoId: 1,
    aluno: students[0].nome,
    descricao: "Acompanhamento acadêmico",
    dataAtendimento: dateTime,
    tipoAtendimento: "dentro",
    categoriaAtendimento: "acompanhamento_do_aluno",
    solicitante: "Coordenação",
    psicologo: "Marina Psicóloga",
    status: "PENDENTE",
    createdAt: dateTime,
  },
];
const pageResponse = (content) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  first: true,
  last: true,
});
const commonResponses = {
  "/unidades": [
    {
      id: 1,
      nome: "SENAC Taguatinga",
      endereco: "Taguatinga Norte",
      telefone: "(61) 0000-0000",
    },
    {
      id: 2,
      nome: "SENAC Plano Piloto",
      endereco: "Asa Sul",
      telefone: "(61) 0000-0001",
    },
  ],
  "/alunos": students,
  "/alunos/paginados": pageResponse(students),
  "/atendimentos": appointments,
  "/atendimentos/paginados": pageResponse(appointments),
  "/cursos": [
    { id: 1, nome: "Técnico em Administração", unidadeId: 1 },
    { id: 2, nome: "Aprendizagem Profissional", unidadeId: 1 },
  ],
  "/turmas": [
    { id: 1, nome: "ADM 2026", cursoId: 1, unidadeId: 1, turno: "MATUTINO" },
    { id: 2, nome: "AP 2026", cursoId: 2, unidadeId: 1, turno: "VESPERTINO" },
  ],
  "/usuarios": [
    {
      id: 30,
      nome: "Paulo Instrutor",
      email: "paulo@senac.br",
      usuario: "paulo.instrutor",
      tipoUsuario: "INSTRUTOR",
      unidade: { id: 1, nome: "SENAC Taguatinga" },
    },
    {
      id: 31,
      nome: "Marina Psicóloga",
      email: "marina@senac.br",
      usuario: "marina.psicologa",
      tipoUsuario: "PSICOLOGO",
      unidade: { id: 1, nome: "SENAC Taguatinga" },
    },
  ],
  "/chat/mensagens": [],
  "/agenda-eventos": [],
};

let pages;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    pages = await fetch(`${endpoint}/json`).then((response) => response.json());
    break;
  } catch {
    await delay(250);
  }
}
if (!pages) throw new Error("O navegador não disponibilizou o endpoint CDP.");
const target = pages.find((page) => page.type === "page");
if (!target) throw new Error("Nenhuma página disponível no endpoint CDP.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const browserErrors = [];
let sequence = 0;
let activeProfile = profiles[0];

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCall, reject) =>
    pending.set(id, { resolve: resolveCall, reject }),
  );
}

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const operation = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) operation.reject(new Error(message.error.message));
    else operation.resolve(message.result);
    return;
  }
  if (message.method === "Fetch.requestPaused") {
    const path = new URL(message.params.request.url).pathname;
    const response =
      path === "/auth/me"
        ? {
            id: profiles.indexOf(activeProfile) + 10,
            nome: `Usuário ${activeProfile.key}`,
            tipoUsuario: activeProfile.backendRole,
            unidadeId: activeProfile.key === "admin" ? null : 1,
            unidade: activeProfile.key === "admin" ? null : "SENAC Taguatinga",
          }
        : commonResponses[path];
    if (response !== undefined) {
      void call("Fetch.fulfillRequest", {
        requestId: message.params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json; charset=utf-8" },
        ],
        body: Buffer.from(JSON.stringify(response)).toString("base64"),
      });
    } else
      void call("Fetch.continueRequest", {
        requestId: message.params.requestId,
      });
  }
  if (message.method === "Runtime.exceptionThrown")
    browserErrors.push(
      message.params.exceptionDetails?.exception?.description ||
        message.params.exceptionDetails?.text,
    );
  if (
    message.method === "Log.entryAdded" &&
    message.params.entry.level === "error"
  )
    browserErrors.push(message.params.entry.text);
});

await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(150);
  }
  throw new Error(`Tempo esgotado aguardando: ${expression}`);
}

await call("Runtime.enable");
await call("Log.enable");
await call("Page.enable");
await call("Fetch.enable", {
  patterns: [{ urlPattern: `${appOrigin}/*`, requestStage: "Request" }],
});

const auditResults = [];
const artifactDirectory = resolve(".artifacts");
mkdirSync(artifactDirectory, { recursive: true });

for (const profile of profiles) {
  activeProfile = profile;
  for (const width of auditWidths) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await call("Page.navigate", { url: `${appOrigin}${profile.path}` });
    await delay(500);
    await waitFor(
      `Boolean(document.querySelector('.app-shell')) && document.querySelectorAll('.stat-card').length > 0`,
    );
    await delay(250);
    const metrics = await evaluate(`(async()=>{
      const visible=(element)=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
      const viewport=document.documentElement.clientWidth;
      const excluded=(element)=>element.closest('.data-table-wrap,.table-responsive,.sidebar-nav,.chat-contact-list');
      const overflow=[...document.querySelectorAll('body *')].filter((element)=>visible(element)&&!excluded(element)).filter((element)=>{const rect=element.getBoundingClientRect();return rect.left < -1 || rect.right > viewport + 1}).map((element)=>({tag:element.tagName,className:String(element.className).slice(0,80),left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right)})).slice(0,10);
      const cards=[...document.querySelectorAll('.stat-card')].filter(visible).map((element)=>Math.round(element.getBoundingClientRect().width));
      const buttons=[...document.querySelectorAll('button')].filter(visible);
      const overlaps=[];
      for(let index=0;index<buttons.length;index+=1){for(let next=index+1;next<buttons.length;next+=1){const a=buttons[index].getBoundingClientRect(),b=buttons[next].getBoundingClientRect();if(a.left < b.right-1&&a.right > b.left+1&&a.top < b.bottom-1&&a.bottom > b.top+1&&!buttons[index].contains(buttons[next])&&!buttons[next].contains(buttons[index]))overlaps.push([buttons[index].textContent.trim(),buttons[next].textContent.trim()]);}}
      const transitions=[];
      for(const label of ${JSON.stringify(profile.labels)}){const button=[...document.querySelectorAll('.nav-link')].find((item)=>item.textContent.includes(label));if(!button)continue;button.click();await new Promise((resolve)=>setTimeout(resolve,100));const screenOverflow=[...document.querySelectorAll('.panel-section.active *')].filter((element)=>visible(element)&&!excluded(element)).filter((element)=>{const rect=element.getBoundingClientRect();return rect.left < -1 || rect.right > viewport + 1}).length;const bannerButtonRows=new Set([...document.querySelectorAll('.wb-actions .btn')].filter(visible).map((element)=>Math.round(element.getBoundingClientRect().top))).size;transitions.push({label,title:document.querySelector('.topbar-page-title')?.textContent,screenOverflow,bannerButtonRows});}
      const sidebar=document.querySelector('.sidebar').getBoundingClientRect();
      const topbarActionRows=new Set([...document.querySelectorAll('.topbar-right > button')].filter(visible).map((element)=>Math.round(element.getBoundingClientRect().top))).size;
      return{width:${width},documentWidth:document.documentElement.scrollWidth,overflow,cards,maxCardWidth:cards.length?Math.max(...cards):0,overlaps,transitions,topbarActionRows,sidebar:{top:Math.round(sidebar.top),bottom:Math.round(sidebar.bottom),width:Math.round(sidebar.width)},logoutVisible:visible(document.querySelector('.mobile-logout'))};
    })()`);
    auditResults.push({ profile: profile.key, ...metrics });

    if (width === 390) {
      const dashboardLabel =
        profile.key === "coordenacao" || profile.key === "instrutor"
          ? "Início"
          : "Dashboard";
      await evaluate(
        `[...document.querySelectorAll('.nav-link')].find((item)=>item.textContent.includes(${JSON.stringify(dashboardLabel)}))?.click()`,
      );
      await delay(120);
      const screenshot = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        resolve(artifactDirectory, `mobile-${profile.key}.png`),
        Buffer.from(screenshot.data, "base64"),
      );

      const detailLabel =
        requestedDetailLabel ||
        (profile.key === "admin"
          ? "Criar Login"
          : profile.key === "psicologo"
            ? "Calendário"
            : "Alunos");
      await evaluate(
        `[...document.querySelectorAll('.nav-link')].find((item)=>item.textContent.includes(${JSON.stringify(detailLabel)}))?.click()`,
      );
      await delay(500);
      const detailScreenshot = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        resolve(
          artifactDirectory,
          requestedDetailLabel
            ? `mobile-${profile.key}-detail-${requestedDetailLabel
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/gi, "-")
                .toLowerCase()}.png`
            : `mobile-${profile.key}-detail.png`,
        ),
        Buffer.from(detailScreenshot.data, "base64"),
      );
    }
  }
}

process.stdout.write(
  `${JSON.stringify({ auditResults, browserErrors }, null, 2)}\n`,
);
await call("Browser.close");
