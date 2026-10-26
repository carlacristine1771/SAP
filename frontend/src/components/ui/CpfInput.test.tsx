// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import CpfInput from "./CpfInput.tsx";

afterEach(cleanup);

function Form() {
  const [cpf, setCpf] = useState("");
  return <CpfInput aria-label="CPF" value={cpf} onChange={setCpf} />;
}

describe("edição do CPF", () => {
  it("permite digitar, colar e limpar mantendo a máscara e o foco", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "52998224725");
    expect(input.value).toBe("529.982.247-25");
    expect(document.activeElement).toBe(input);
    await user.clear(input);
    await user.paste("529.982.247-25");
    expect(input.value).toBe("529.982.247-25");
    await user.clear(input);
    expect(input.value).toBe("");
  });

  it("permite editar no meio e apagar atravessando separadores", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "52998224725");
    input.setSelectionRange(4, 4);
    await user.keyboard("{Backspace}");
    expect(input.value).toBe("529.822.472-5");
    expect(input.selectionStart).toBe(2);
    await user.keyboard("9");
    expect(input.value).toBe("529.982.247-25");
    expect(input.selectionStart).toBe(3);
    await user.keyboard("{Delete}");
    expect(input.value).toBe("529.822.472-5");
    input.setSelectionRange(0, input.value.length);
    await user.keyboard("{Backspace}");
    expect(input.value).toBe("");
  });
});
