import { useState } from "react";
import Icon from "../panel/Icon.jsx";

interface Appointment {
  id: number | string;
  aluno?: string;
  descricao?: string;
  dataAtendimento?: string;
  tipoAtendimento?: string;
  status?: string;
  solicitante?: string;
}
interface AgendaEvent {
  id: number | string;
  titulo?: string;
  descricao?: string;
  dataInicio?: string;
  diaInteiro?: boolean;
  tipo?: string;
  cor?: string;
}
type CalendarEntry =
  | (Appointment & { kind: "appointment"; label: string; date: string })
  | (AgendaEvent & { kind: "event"; label: string; date: string });
interface Props {
  appointments: Appointment[];
  events: AgendaEvent[];
  statusMeta: Record<string, [string, string, ...string[]]>;
  eventTypes: Record<string, string>;
  onAppointment: (entry: Appointment) => void;
  onEvent: (entry: AgendaEvent) => void;
  onNewEvent: (date: Date) => void;
  onNewAppointment: (date: Date) => void;
}

function localDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fmtDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function PsychologyCalendar({
  appointments,
  events,
  statusMeta,
  eventTypes,
  onAppointment,
  onEvent,
  onNewEvent,
  onNewAppointment,
}: Props) {
  const [cursor, setCursor] = useState(() => new Date()),
    [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  const todayKey = localDateKey(new Date()),
    daysLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const entriesFor = (date: Date): CalendarEntry[] => {
    const key = localDateKey(date);
    return [
      ...appointments
        .filter((item) => String(item.dataAtendimento).slice(0, 10) === key)
        .map((item) => ({
          ...item,
          kind: "appointment" as const,
          label: item.aluno || "—",
          date: item.dataAtendimento || "",
        })),
      ...events
        .filter((item) => String(item.dataInicio).slice(0, 10) === key)
        .map((item) => ({
          ...item,
          kind: "event" as const,
          label: item.titulo || "Evento",
          date: item.dataInicio || "",
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  };
  const selectEntry = (entry: CalendarEntry) =>
    entry.kind === "event" ? onEvent(entry) : onAppointment(entry);
  const entryColor = (entry: CalendarEntry) =>
    entry.kind === "event"
      ? entry.cor || "#1B4E9B"
      : entry.tipoAtendimento === "remoto"
        ? "#3b82f6"
        : entry.tipoAtendimento === "fora"
          ? "#f5c518"
          : entry.status === "FINALIZADO"
            ? "#154360"
            : entry.status === "CANCELADO"
              ? "#c0392b"
              : entry.status === "EM_ANDAMENTO"
                ? "#1e8449"
                : "#c87f00";
  const entryType = (entry: CalendarEntry) =>
    entry.kind === "event"
      ? eventTypes[entry.tipo || ""] || entry.tipo
      : statusMeta[entry.status || ""]?.[0] || entry.status;
  const entryTime = (entry: CalendarEntry) =>
    entry.kind === "event" && entry.diaInteiro
      ? "Dia inteiro"
      : entry.date.slice(11, 16) || "--:--";
  const move = (amount: number) =>
    setCursor((current) => {
      const next = new Date(current);
      if (view === "mes") next.setMonth(next.getMonth() + amount);
      else next.setDate(next.getDate() + amount * (view === "semana" ? 7 : 1));
      return next;
    });
  const openDay = (date: Date) => {
    setCursor(new Date(date));
    setView("dia");
  };
  const title =
    view === "mes"
      ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : view === "semana"
        ? (() => {
            const start = new Date(cursor);
            start.setDate(cursor.getDate() - cursor.getDay());
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} — ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
          })()
        : cursor.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
  const monthView = () => {
    const year = cursor.getFullYear(),
      month = cursor.getMonth(),
      days = new Date(year, month + 1, 0).getDate(),
      first = new Date(year, month, 1).getDay(),
      cells: (number | null)[] = [
        ...Array<null>(first).fill(null),
        ...Array.from({ length: days }, (_, index) => index + 1),
      ];
    return (
      <div className="cal-grid-month">
        {daysLabel.map((label) => (
          <div className="cal-weekday" key={label}>
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} />;
          const date = new Date(year, month, day),
            entries = entriesFor(date);
          return (
            <div
              className={`cal-day-card${todayKey === localDateKey(date) ? " today" : ""}`}
              role="button"
              tabIndex={0}
              title={`Abrir agenda de ${day}`}
              key={day}
              onClick={() => openDay(date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDay(date);
                }
              }}
            >
              <div className="cal-day-head">
                <span className="cal-day-number">{day}</span>
                <span className="cal-day-count">{entries.length} item(ns)</span>
              </div>
              <div className="cal-events-list">
                {!entries.length && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gray-300)",
                      padding: "6px 2px",
                    }}
                  >
                    Nada marcado
                  </div>
                )}
                {entries.map((entry) => (
                  <button
                    type="button"
                    className="cal-event-pill"
                    style={{ borderLeft: `3px solid ${entryColor(entry)}` }}
                    key={`${entry.kind}-${entry.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectEntry(entry);
                    }}
                  >
                    <strong>
                      {entryTime(entry)} · {entry.label}
                    </strong>
                    <span>{entryType(entry)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const weekView = () => {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - cursor.getDay());
    return (
      <div className="cal-week-grid">
        {Array.from({ length: 7 }, (_, index) => {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          const entries = entriesFor(date);
          return (
            <div
              className={`cal-week-col${todayKey === localDateKey(date) ? " today" : ""}`}
              key={localDateKey(date)}
            >
              <button
                type="button"
                className="cal-week-head psychologist-calendar-head"
                onClick={() => openDay(date)}
              >
                <div>{daysLabel[date.getDay()]}</div>
                <strong>{date.getDate()}</strong>
                <span>{entries.length} item(ns)</span>
              </button>
              <div className="cal-week-body">
                {!entries.length && (
                  <div className="psych-calendar-empty">Nada marcado</div>
                )}
                {entries.map((entry) => (
                  <button
                    type="button"
                    className="cal-week-event"
                    style={{ borderLeft: `3px solid ${entryColor(entry)}` }}
                    key={`${entry.kind}-${entry.id}`}
                    onClick={() => selectEntry(entry)}
                  >
                    <div
                      className="cal-week-event-time"
                      style={{ color: entryColor(entry) }}
                    >
                      {entryTime(entry)}
                    </div>
                    <div className="cal-week-event-name">{entry.label}</div>
                    <div className="psych-calendar-kind">
                      {entry.kind === "event"
                        ? entryType(entry)
                        : "Atendimento"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const dayView = () => {
    const entries = entriesFor(cursor);
    return (
      <div className="cal-day-agenda">
        {!entries.length ? (
          <div className="cal-day-empty">
            <Icon name="calendar" size={40} />
            <div>Nada marcado neste dia</div>
            <div className="psych-calendar-empty-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onNewEvent(cursor)}
              >
                + Novo evento
              </button>
              <button
                className="btn btn-orange btn-sm"
                onClick={() => onNewAppointment(cursor)}
              >
                + Atendimento
              </button>
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <button
              type="button"
              className="cal-day-event"
              style={{ borderLeft: `3px solid ${entryColor(entry)}` }}
              key={`${entry.kind}-${entry.id}`}
              onClick={() => selectEntry(entry)}
            >
              <div className="cal-day-time">
                <strong>{entryTime(entry)}</strong>
                <span>
                  {entry.kind === "event"
                    ? entryType(entry)
                    : entry.tipoAtendimento || "Atendimento"}
                </span>
              </div>
              <div className="cal-day-body">
                <h4>{entry.label}</h4>
                <p>
                  {entry.descricao ||
                    (entry.kind === "event"
                      ? "Evento da agenda"
                      : "Sem motivo informado")}
                </p>
                <div>
                  <span
                    className={`badge ${entry.kind === "event" ? "badge-info" : statusMeta[entry.status || ""]?.[1]}`}
                  >
                    {entryType(entry)}
                  </span>
                </div>
                {entry.kind === "appointment" && (
                  <div className="cal-day-meta">
                    <span>Data: {fmtDate(entry.dataAtendimento)}</span>
                    <span>Solicitado por: {entry.solicitante || "—"}</span>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    );
  };
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Calendário de Atendimentos</div>
          <div className="psych-calendar-toolbar">
            <div className="tab-group">
              {(
                [
                  ["mes", "Mês"],
                  ["semana", "Semana"],
                  ["dia", "Dia"],
                ] as const
              ).map(([key, label]) => (
                <button
                  type="button"
                  className={`tab-btn${view === key ? " active" : ""}`}
                  onClick={() => setView(key)}
                  key={key}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="btn btn-outline btn-sm"
              aria-label="Período anterior"
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <span className="psych-calendar-title">{title}</span>
            <button
              className="btn btn-outline btn-sm"
              aria-label="Próximo período"
              onClick={() => move(1)}
            >
              ›
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCursor(new Date())}
            >
              Hoje
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onNewEvent(cursor)}
            >
              <Icon name="plus" />
              Novo Evento
            </button>
            <button
              className="btn btn-orange btn-sm"
              onClick={() => onNewAppointment(cursor)}
            >
              <Icon name="plus" />
              Novo Atendimento
            </button>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {view === "mes"
            ? monthView()
            : view === "semana"
              ? weekView()
              : dayView()}
        </div>
      </div>
    </div>
  );
}
