package br.com.sap.dto.aluno;

import br.com.sap.entity.enums.Turno;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlunoRequestDTO {

    @NotBlank(message = "O nome é obrigatório")
    private String nome;

    @NotBlank(message = "O CPF é obrigatório")
    private String cpf;

    @NotNull(message = "A data de nascimento é obrigatória")
    private LocalDate dataNascimento;

    @NotBlank(message = "O telefone é obrigatório")
    private String telefone;

    @Email(message = "E-mail inválido")
    private String email;

    @NotBlank(message = "O responsável é obrigatório")
    private String responsavel;

    @NotNull(message = "O turno é obrigatório")
    private Turno turno;

    private String observacoes;

    @NotNull(message = "A unidade é obrigatória")
    private Long unidadeId;

    private Long cursoId;

    private Long turmaId;
}