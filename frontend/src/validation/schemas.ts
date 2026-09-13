import { z } from "zod";

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} é obrigatório.`);
const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.email().safeParse(value).success,
    "Informe um e-mail válido.",
  );

function validCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return (
    calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10])
  );
}

export const studentSchema = z.object({
  nome: requiredText("Nome"),
  cpf: requiredText("CPF").refine(validCpf, "Informe um CPF válido."),
  dataNascimento: requiredText("Data de nascimento").refine(
    (value) => new Date(`${value}T12:00:00`) <= new Date(),
    "A data de nascimento não pode ser futura.",
  ),
  telefone: requiredText("Telefone").refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
  }, "Informe um telefone com DDD."),
  email: optionalEmail,
  cursoId: requiredText("Curso"),
  turmaId: requiredText("Turma"),
});

export const appointmentSchema = z.object({
  alunoId: z
    .union([z.string(), z.number()])
    .refine(Boolean, "Selecione o aluno."),
  descricao: requiredText("Motivo"),
  dataAtendimento: requiredText("Data e horário"),
});

export const eventSchema = z
  .object({
    titulo: requiredText("Título"),
    dataInicio: requiredText("Data de início"),
    dataFim: z.string().optional().default(""),
  })
  .refine(({ dataInicio, dataFim }) => !dataFim || dataFim >= dataInicio, {
    message: "A data final deve ser posterior ao início.",
    path: ["dataFim"],
  });

export const unitSchema = z.object({
  nome: requiredText("Nome da unidade"),
  endereco: requiredText("Região"),
});

export const userSchema = z.object({
  nome: requiredText("Nome"),
  usuario: requiredText("Usuário"),
  senha: z
    .string()
    .refine(
      (value) => !value || value.length >= 6,
      "A senha deve ter ao menos 6 caracteres.",
    ),
  unidadeId: z.string(),
});

export const createUserSchema = z
  .object({
    role: requiredText("Perfil"),
    nome: requiredText("Nome"),
    email: z.email("Informe um e-mail válido."),
    usuario: requiredText("Usuário"),
    senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
    unidadeId: z.string(),
  })
  .refine(({ role, unidadeId }) => role === "administrador" || unidadeId, {
    message: "Selecione a unidade do usuário.",
    path: ["unidadeId"],
  });

export function validationMessage(
  result: { success: true } | { success: false; error: z.ZodError },
) {
  return result.success
    ? ""
    : result.error.issues[0]?.message || "Revise os campos informados.";
}
