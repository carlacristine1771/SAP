import { useEffect, useMemo, useRef } from "react";

const COLORS = [
  "#2d7ff9",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#6366f1",
];

function ageFromDate(value) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age >= 0 && age <= 120 ? age : null;
}

function useCanvasRedraw(draw, dependencies) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const redraw = () => draw(canvas);
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return ref;
}

export default function DashboardCharts({ students }) {
  const courseData = useMemo(() => {
    const counts = {};
    students.forEach((student) => {
      const name = student.curso || "Sem curso";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, "pt-BR"),
    );
  }, [students]);
  const ageData = useMemo(() => {
    const counts = {};
    students.forEach((student) => {
      const age = ageFromDate(student.dataNascimento);
      if (age !== null) counts[age] = (counts[age] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([age, count]) => [Number(age), count])
      .sort(([left], [right]) => left - right);
  }, [students]);

  const donutRef = useCanvasRedraw(
    (canvas) => {
      const scale = window.devicePixelRatio || 1;
      const size = 260;
      canvas.width = size * scale;
      canvas.height = size * scale;
      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      const center = size / 2;
      const radius = center - 18;
      const total = students.length;
      const rootStyle = getComputedStyle(document.documentElement);
      const surface = rootStyle.getPropertyValue("--white").trim() || "#fff";
      const ink = rootStyle.getPropertyValue("--ink").trim() || "#0f172a";
      const muted =
        rootStyle.getPropertyValue("--gray-500").trim() || "#6b7280";
      context.clearRect(0, 0, size, size);
      if (!total) {
        context.fillStyle = "#ccc";
        context.beginPath();
        context.arc(center, center, radius, 0, Math.PI * 2);
        context.fill();
        return;
      }
      let angle = -Math.PI / 2;
      courseData.forEach(([, count], index) => {
        const end = angle + (count / total) * Math.PI * 2;
        context.beginPath();
        context.moveTo(center, center);
        context.arc(center, center, radius, angle, end);
        context.closePath();
        context.fillStyle = COLORS[index % COLORS.length];
        context.fill();
        context.strokeStyle = surface;
        context.lineWidth = 3;
        context.stroke();
        angle = end;
      });
      context.save();
      context.shadowColor = "rgba(15,23,42,.16)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 7;
      context.beginPath();
      context.arc(center, center, radius * 0.5, 0, Math.PI * 2);
      context.fillStyle = surface;
      context.fill();
      context.restore();
      context.fillStyle = ink;
      context.font = "bold 22px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(total, center, center - 8);
      context.font = "11px sans-serif";
      context.fillStyle = muted;
      context.fillText("alunos", center, center + 14);
    },
    [courseData, students.length],
  );

  const lineRef = useCanvasRedraw(
    (canvas) => {
      const width = Math.max(canvas.clientWidth || 460, 280);
      const height = 240;
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      context.clearRect(0, 0, width, height);
      if (!ageData.length) {
        context.fillStyle = "#94a3b8";
        context.font = "13px sans-serif";
        context.textAlign = "center";
        context.fillText("Nenhum dado de idade cadastrado", width / 2, 120);
        return;
      }
      const PL = 44,
        PR = 16,
        PT = 16,
        PB = 36;
      const values = ageData.map(([, value]) => value);
      const max = Math.max(...values, 1);
      const xStep =
        ageData.length > 1 ? (width - PL - PR) / (ageData.length - 1) : 0;
      const px = (index) =>
        ageData.length === 1 ? PL + (width - PL - PR) / 2 : PL + index * xStep;
      const py = (value) => PT + (height - PT - PB) * (1 - value / max);
      context.strokeStyle = "rgba(100,116,139,.12)";
      context.lineWidth = 1;
      for (let grid = 0; grid <= 4; grid++) {
        const y = PT + ((height - PT - PB) * grid) / 4;
        context.beginPath();
        context.moveTo(PL, y);
        context.lineTo(width - PR, y);
        context.stroke();
        context.fillStyle = "#94a3b8";
        context.font = "10px sans-serif";
        context.textAlign = "right";
        context.fillText(Math.round(max * (1 - grid / 4)), PL - 5, y + 3);
      }
      context.beginPath();
      context.moveTo(px(0), py(values[0]));
      values
        .slice(1)
        .forEach((value, index) => context.lineTo(px(index + 1), py(value)));
      context.lineTo(px(values.length - 1), height - PB);
      context.lineTo(px(0), height - PB);
      context.closePath();
      context.fillStyle = "rgba(45,127,249,.1)";
      context.fill();
      context.beginPath();
      context.moveTo(px(0), py(values[0]));
      values
        .slice(1)
        .forEach((value, index) => context.lineTo(px(index + 1), py(value)));
      context.strokeStyle = "#2d7ff9";
      context.lineWidth = 2.5;
      context.lineJoin = "round";
      context.stroke();
      values.forEach((value, index) => {
        context.beginPath();
        context.arc(px(index), py(value), 4, 0, Math.PI * 2);
        context.fillStyle = "#2d7ff9";
        context.strokeStyle = "#fff";
        context.lineWidth = 2;
        context.fill();
        context.stroke();
      });
      context.fillStyle = "#64748b";
      context.font = "11px sans-serif";
      context.textAlign = "center";
      const step = ageData.length > 12 ? Math.ceil(ageData.length / 12) : 1;
      ageData.forEach(([age], index) => {
        if (index % step === 0)
          context.fillText(`${age} anos`, px(index), height - PB + 16);
      });
      context.save();
      context.translate(11, PT + (height - PT - PB) / 2);
      context.rotate(-Math.PI / 2);
      context.font = "10px sans-serif";
      context.fillStyle = "#94a3b8";
      context.textAlign = "center";
      context.fillText("nº de alunos", 0, 0);
      context.restore();
    },
    [ageData],
  );

  return (
    <div
      className="admin-charts-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginTop: 24,
      }}
    >
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Distribuição por Curso</div>
        </div>
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <canvas
            ref={donutRef}
            role="img"
            aria-label="Gráfico de distribuição dos alunos por curso"
            style={{ width: 260, height: 260, maxWidth: "100%" }}
          >
            Distribuição dos alunos por curso.
          </canvas>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 12.5,
            }}
          >
            {courseData.map(([name, count], index) => (
              <div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
                key={name}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: COLORS[index % COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, fontWeight: 600, color: "var(--ink)" }}>
                  {name}
                </div>
                <div style={{ color: "var(--gray-500)" }}>
                  {count} aluno{count !== 1 ? "s" : ""}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color: COLORS[index % COLORS.length],
                    minWidth: 38,
                    textAlign: "right",
                  }}
                >
                  {students.length
                    ? Math.round((count / students.length) * 100)
                    : 0}
                  %
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Alunos por Idade</div>
        </div>
        <div style={{ padding: 20 }}>
          <canvas
            ref={lineRef}
            role="img"
            aria-label="Gráfico da quantidade de alunos por idade"
            style={{ width: "100%", height: 240 }}
          >
            Quantidade de alunos por idade.
          </canvas>
        </div>
      </div>
    </div>
  );
}
