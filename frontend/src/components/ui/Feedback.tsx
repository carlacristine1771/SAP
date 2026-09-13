import type { ReactNode } from "react";
import type { ToastMessage } from "../../types/domain.ts";

export function ErrorMessage({
  text,
  children,
}: {
  text?: string;
  children?: ReactNode;
}) {
  const content = text || children;
  return content ? (
    <div className="err-msg" role="alert" style={{ display: "block" }}>
      {content}
    </div>
  ) : null;
}

export function ToastRegion({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div
      id="toast-container"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

export function LoadingScreen({
  message = "Carregando painel...",
}: {
  message?: string;
}) {
  return (
    <>
      <link rel="stylesheet" href="/css/global.css" />
      <div className="sap-loading-screen" role="status" aria-live="polite">
        {message}
      </div>
    </>
  );
}

export function FatalScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <>
      <link rel="stylesheet" href="/css/global.css" />
      <div className="sap-loading-screen" role="alert">
        <div>
          <strong>Não foi possível abrir esta tela.</strong>
          <p>{message}</p>
          {onRetry && (
            <button className="btn btn-primary" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    </>
  );
}
