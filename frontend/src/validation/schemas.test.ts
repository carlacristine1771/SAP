import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  createUserSchema,
  eventSchema,
  studentSchema,
} from "./schemas.ts";

describe("validações dos formulários", () => {
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
