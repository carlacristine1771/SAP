import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  createUserSchema,
  eventSchema,
  studentSchema,
  formatCpf,
  instructorSchema,
  userSchema,
} from "./schemas.ts";

describe("validações dos formulários", () => {
  const student = {
    nome: "Aluno de teste",
    cpf: "52998224725",
    dataNascimento: "2007-05-10",
    telefone: "(61) 99999-1111",
    email: "",
    cursoId: "1",
    turmaId: "1",
  };

  it.each(["52998224725", "529.982.247-25"])("aceita CPF válido %s", (cpf) => {
    expect(studentSchema.safeParse({ ...student, cpf }).success).toBe(true);
  });

  it.each([
    "",
    "11111111111",
    "00000000000",
    "52998224724",
    "52998224715",
    "5299822472",
    "529982247250",
    "abc52998224725",
    "529-982-247.25",
  ])("rejeita CPF inválido %s", (cpf) => {
    expect(studentSchema.safeParse({ ...student, cpf }).success).toBe(false);
  });

  it("aplica máscara progressiva e limita os dígitos do CPF", () => {
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("5299822")).toBe("529.982.2");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529.982.247-259")).toBe("529.982.247-25");
  });

  it("valida e-mail opcional de aluno e obrigatório de instrutor sem perder dados", () => {
    expect(studentSchema.safeParse(student).success).toBe(true);
    expect(
      studentSchema.safeParse({ ...student, email: "teste@" }).success,
    ).toBe(false);
    const instructor = {
      nome: "Instrutor",
      usuario: "teste",
      email: " teste@gmail.com ",
      senha: "",
    };
    expect(instructorSchema.parse(instructor).email).toBe("teste@gmail.com");
    for (const email of ["", "teste@", "teste gmail.com", "teste@gmail"])
      expect(instructorSchema.safeParse({ ...instructor, email }).success).toBe(
        false,
      );
    expect(instructor.email).toBe(" teste@gmail.com ");
  });

  it("aceita senha opcional vazia na edição e rejeita senha curta ou só espaços", () => {
    const user = { nome: "Teste", usuario: "teste", unidadeId: "", senha: "" };
    expect(userSchema.safeParse(user).success).toBe(true);
    for (const senha of ["a", "12345", "      "])
      expect(userSchema.safeParse({ ...user, senha }).success).toBe(false);
    expect(
      userSchema.safeParse({ ...user, senha: "senha de teste" }).success,
    ).toBe(true);
  });

  it("rejeita datas inexistentes e campos obrigatórios em branco", () => {
    expect(
      studentSchema.safeParse({ ...student, dataNascimento: "2026-02-30" })
        .success,
    ).toBe(false);
    for (const field of ["nome", "telefone", "cursoId", "turmaId"])
      expect(
        studentSchema.safeParse({ ...student, [field]: "   " }).success,
      ).toBe(false);
  });
  it("valida CPF, telefone e data do aluno", () => {
    const valid = studentSchema.safeParse({
      nome: "Ana Souza",
      cpf: "529.982.247-25",
      dataNascimento: "2007-05-10",
      telefone: "(61) 99999-1111",
      email: "ana@example.com",
      cursoId: "1",
      turmaId: "1",
    });
    expect(valid.success).toBe(true);
    expect(
      studentSchema.safeParse({
        nome: "Ana",
        cpf: "111.111.111-11",
        dataNascimento: "2999-01-01",
        telefone: "123",
        email: "inválido",
        cursoId: "",
        turmaId: "",
      }).success,
    ).toBe(false);
  });

  it("exige unidade para perfis que não são administrador geral", () => {
    const base = {
      nome: "Maria",
      email: "maria@example.com",
      usuario: "maria",
      senha: "123456",
      unidadeId: "",
    };
    expect(
      createUserSchema.safeParse({ ...base, role: "administrador" }).success,
    ).toBe(true);
    expect(
      createUserSchema.safeParse({ ...base, role: "psicologa" }).success,
    ).toBe(false);
  });

  it("valida atendimento e ordem das datas do evento", () => {
    expect(
      appointmentSchema.safeParse({
        alunoId: "1",
        descricao: "Acompanhamento",
        dataAtendimento: "2027-10-01T09:00",
      }).success,
    ).toBe(true);
    expect(
      eventSchema.safeParse({
        titulo: "Reunião",
        dataInicio: "2027-10-01T10:00",
        dataFim: "2027-10-01T09:00",
      }).success,
    ).toBe(false);
  });
});
