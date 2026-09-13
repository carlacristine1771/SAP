import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client.ts";
import Icon from "./Icon.jsx";
import AccessibleModal from "../ui/AccessibleModal.tsx";

function roleLabel(user) {
  const role = String(user?.tipoUsuario || "").toUpperCase();
  if (role === "PSICOLOGO") return "Psicóloga";
  if (role === "INSTRUTOR") return "Instrutor";
  if (role === "COORDENACAO") return "Coordenação";
  if (role === "ADMINISTRADOR" || role === "ADMIN_UNIDADE")
    return "Administrador";
  return "Usuário";
}

function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${parts[0]?.[0] || "?"}${parts.length > 1 ? parts.at(-1)?.[0] : ""}`.toUpperCase();
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay(date, today)) return `Hoje às ${time}`;
  if (sameDay(date, yesterday)) return `Ontem às ${time}`;
  return `${date.toLocaleDateString("pt-BR")} às ${time}`;
}

export default function ChatPanel({
  session,
  users,
  messages,
  onRefresh,
  onToast,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [extraContactIds, setExtraContactIds] = useState([]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(null);
  const currentId = Number(session?.id);

  const availableUsers = useMemo(
    () =>
      users
        .filter((user) => {
          if (!user?.ativo || Number(user.id) === currentId) return false;
          if (!session?.unidadeId) return true;
          const userUnitId = user.unidade?.id;
          return (
            !userUnitId ||
            Number(userUnitId) === Number(session.unidadeId) ||
            user.tipoUsuario === "ADMINISTRADOR"
          );
        })
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    [currentId, session?.unidadeId, users],
  );

  const conversations = useMemo(() => {
    const ids = new Set(extraContactIds.map(Number));
    messages.forEach((message) => {
      if (Number(message.remetenteId) === currentId)
        ids.add(Number(message.destinatarioId));
      if (Number(message.destinatarioId) === currentId)
        ids.add(Number(message.remetenteId));
    });
    return availableUsers
      .filter((user) => ids.has(Number(user.id)))
      .sort((a, b) => {
        const lastFor = (id) =>
          messages
            .filter(
              (message) =>
                (Number(message.remetenteId) === currentId &&
                  Number(message.destinatarioId) === Number(id)) ||
                (Number(message.destinatarioId) === currentId &&
                  Number(message.remetenteId) === Number(id)),
            )
            .at(-1)?.createdAt || 0;
        return new Date(lastFor(b.id)) - new Date(lastFor(a.id));
      });
  }, [availableUsers, currentId, extraContactIds, messages]);

  useEffect(() => {
    if (!selectedId && conversations.length)
      setSelectedId(Number(conversations[0].id));
  }, [conversations, selectedId]);

  const selected = availableUsers.find(
    (user) => Number(user.id) === Number(selectedId),
  );
  const selectedMessages = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            (Number(message.remetenteId) === currentId &&
              Number(message.destinatarioId) === Number(selectedId)) ||
            (Number(message.destinatarioId) === currentId &&
              Number(message.remetenteId) === Number(selectedId)),
        )
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [currentId, messages, selectedId],
  );

  useEffect(() => {
    const area = messagesRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [selectedMessages]);

  const selectContact = async (id) => {
    setSelectedId(Number(id));
    setExtraContactIds((current) =>
      current.includes(Number(id)) ? current : [...current, Number(id)],
    );
    try {
      await api.patch(`/chat/mensagens/lidas/${id}`);
      await onRefresh("chat");
    } catch {
      /* leitura da conversa continua disponível mesmo se a confirmação falhar */
    }
  };

  const send = async () => {
    const messageText = text.trim();
    if (!messageText || !selectedId || sending) return;
    setSending(true);
    try {
      await api.post("/chat/mensagens", {
        destinatarioId: Number(selectedId),
        texto: messageText,
        unidadeId: session?.unidadeId || null,
      });
      setText("");
      await onRefresh("chat");
    } catch (error) {
      onToast(error.message || "Não foi possível enviar a mensagem.", "danger");
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = availableUsers.filter((user) =>
    [user.nome, user.usuario, user.email, roleLabel(user)]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  let previousDay = "";

  return (
    <>
      <div className="chat-wrap-enhanced">
        <aside className="chat-sidebar-panel">
          <div className="chat-sidebar-head">
            <div>
              <strong>Conversas</strong>
              <small>Usuários do sistema</small>
            </div>
            <button
              type="button"
              className="btn btn-orange btn-sm chat-new-btn"
              onClick={() => setNewChatOpen(true)}
            >
              + Nova
            </button>
          </div>
          <div className="chat-tabs chat-contact-list">
            {!conversations.length && (
              <div className="chat-empty-msg" style={{ padding: 22 }}>
                Nenhuma conversa ainda.
                <br />
                Clique em <b>+ Nova</b> para iniciar.
              </div>
            )}
            {conversations.map((user) => {
              const list = messages.filter(
                (message) =>
                  (Number(message.remetenteId) === currentId &&
                    Number(message.destinatarioId) === Number(user.id)) ||
                  (Number(message.destinatarioId) === currentId &&
                    Number(message.remetenteId) === Number(user.id)),
              );
              const last = list.at(-1);
              const unread = list.filter(
                (message) =>
                  Number(message.remetenteId) === Number(user.id) &&
                  !message.lida,
              ).length;
              return (
                <button
                  type="button"
                  className={`chat-tab chat-contact-item${Number(selectedId) === Number(user.id) ? " active" : ""}`}
                  onClick={() => selectContact(user.id)}
                  key={user.id}
                >
                  <span className="chat-contact-avatar">
                    {initials(user.nome)}
                  </span>
                  <span className="chat-contact-text">
                    <span className="chat-contact-name">{user.nome}</span>
                    <span className="chat-contact-role">{roleLabel(user)}</span>
                    <span className="chat-contact-preview">
                      {last?.texto?.slice(0, 44) ||
                        "Clique para abrir conversa"}
                    </span>
                  </span>
                  {unread > 0 && <span className="chat-unread">{unread}</span>}
                </button>
              );
            })}
          </div>
        </aside>
        <section className="chat-main-panel">
          <div className="chat-current-header">
            <div className="chat-current-avatar">
              {selected ? initials(selected.nome) : "?"}
            </div>
            <div className="chat-current-info">
              <strong>{selected?.nome || "Selecione uma conversa"}</strong>
              <small>
                {selected
                  ? roleLabel(selected)
                  : "Escolha um contato na lateral ou inicie uma nova conversa"}
              </small>
            </div>
          </div>
          <div className="chat-body">
            {!selected && (
              <div className="chat-empty-msg">
                Selecione uma conversa na lateral ou clique em + Nova.
              </div>
            )}
            {selected && !selectedMessages.length && (
              <div className="chat-empty-msg">
                Nenhuma mensagem com este contato.
                <br />
                Digite abaixo para iniciar.
              </div>
            )}
            {selected && selectedMessages.length > 0 && (
              <div className="chat-messages-area" ref={messagesRef}>
                {selectedMessages.map((message) => {
                  const key = new Date(message.createdAt).toDateString();
                  const separator = key !== previousDay;
                  previousDay = key;
                  return (
                    <div key={message.id} style={{ display: "contents" }}>
                      {separator && (
                        <div className="chat-day-separator">
                          {dayLabel(message.createdAt)}
                        </div>
                      )}
                      <div
                        className={`chat-msg ${Number(message.remetenteId) === currentId ? "sent" : "recv"}`}
                      >
                        <div className="chat-bubble">{message.texto}</div>
                        <div className="chat-meta">
                          {timeLabel(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="chat-input-row">
            <textarea
              className="chat-textarea"
              rows="1"
              aria-label="Mensagem"
              placeholder="Digite sua mensagem..."
              disabled={!selected || sending}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              className="chat-send-btn"
              aria-label="Enviar mensagem"
              disabled={!selected || !text.trim() || sending}
              onClick={send}
            >
              <Icon name="send" strokeWidth={2.5} />
            </button>
          </div>
        </section>
      </div>

      <AccessibleModal
        open={newChatOpen}
        title="Nova conversa"
        onClose={() => setNewChatOpen(false)}
        maxWidth={620}
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--gray-500)",
            margin: "-12px 0 14px",
          }}
        >
          Escolha um usuário para iniciar o chat.
        </p>
        <input
          className="form-control"
          aria-label="Buscar usuário"
          placeholder="Buscar usuário pelo nome, login ou função..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="chat-user-list">
          {!filteredUsers.length && (
            <div className="empty-state" style={{ padding: 22 }}>
              <div className="empty-state-title">Nenhum usuário encontrado</div>
            </div>
          )}
          {filteredUsers.map((user) => (
            <button
              type="button"
              className="chat-user-option"
              key={user.id}
              onClick={() => {
                setNewChatOpen(false);
                selectContact(user.id);
              }}
            >
              <span className="chat-contact-avatar">{initials(user.nome)}</span>
              <span>
                <strong>{user.nome}</strong>
                <small>{user.email || user.usuario}</small>
              </span>
              <span className="chat-user-role-pill">{roleLabel(user)}</span>
            </button>
          ))}
        </div>
      </AccessibleModal>
    </>
  );
}
