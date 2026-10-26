import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatCpf } from "../../validation/schemas.ts";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export default function CpfInput({ value, onChange, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const update = (raw: string, digitsBeforeCaret: number) => {
    const formatted = formatCpf(raw);
    let position = 0;
    let digits = 0;
    while (position < formatted.length && digits < digitsBeforeCaret) {
      if (/\d/.test(formatted[position])) digits += 1;
      position += 1;
    }
    caret.current = position;
    onChange(formatted);
    // Also restore the caret when filtering a character leaves the value unchanged.
    if (inputRef.current) {
      inputRef.current.value = formatted;
      inputRef.current.setSelectionRange(position, position);
    }
  };

  useLayoutEffect(() => {
    if (caret.current !== null) {
      inputRef.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder="000.000.000-00"
      value={value}
      onChange={(event) => {
        const raw = event.target.value;
        update(
          raw,
          raw
            .slice(0, event.target.selectionStart ?? raw.length)
            .replace(/\D/g, "").length,
        );
      }}
      onKeyDown={(event) => {
        const input = event.currentTarget;
        const start = input.selectionStart ?? 0;
        if (start !== input.selectionEnd) return;
        const backwards = event.key === "Backspace";
        const forwards = event.key === "Delete";
        const adjacent = backwards ? start - 1 : start;
        if (!(backwards || forwards) || !/[.-]/.test(value[adjacent] ?? ""))
          return;
        event.preventDefault();
        const digits = value.replace(/\D/g, "");
        const before = value.slice(0, start).replace(/\D/g, "").length;
        const remove = backwards ? before - 1 : before;
        update(
          digits.slice(0, remove) + digits.slice(remove + 1),
          backwards ? remove : before,
        );
      }}
    />
  );
}
