package br.com.sap.dto.turma;

import br.com.sap.entity.enums.Turno;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TurmaRequestDTO {
    @NotBlank(message = "O nome da turma é obrigatório")
    private String nome;
    @NotNull(message = "O turno é obrigatório")
    private Turno turno;
    @NotNull(message = "O curso é obrigatório")
    private Long cursoId;
    @NotNull(message = "A unidade é obrigatória")
    private Long unidadeId;
    private Long instrutorId;
    private Boolean ativo;
}
