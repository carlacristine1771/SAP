import { useId, useRef, type ReactNode } from "react";
import { useModalFocus } from "../../hooks/useModalFocus.ts";

interface AccessibleModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

export default function AccessibleModal({
  open,
  title,
  onClose,
  children,
  maxWidth = 560,
}: AccessibleModalProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  useModalFocus(boxRef, open, onClose);

  if (!open) return null;
  return (
    <div
      className="modal-overlay open"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className="modal-box"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2
            id={titleId}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--senac-navy)",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-plain"
            aria-label="Fechar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
