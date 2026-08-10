package br.com.sap.dto.aluno;

import br.com.sap.entity.enums.Turno;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlunoResponseDTO {

    private Long id;

    private String nome;

    private String cpf;

    private LocalDate dataNascimento;

    private String telefone;

    private String email;

    private String responsavel;

    private Turno turno;

    private String observacoes;

    private Boolean ativo;

    private Long unidadeId;

    private String unidade;

    private Long cursoId;

    private String curso;

    private Long turmaId;

    private String turma;

    private String createdAt;
}