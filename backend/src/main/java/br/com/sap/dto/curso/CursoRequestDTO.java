package br.com.sap.dto.curso;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CursoRequestDTO {
    @NotBlank(message = "O nome do curso é obrigatório")
    private String nome;
    private String tipoAprendizagem;
    private String descricao;
    @NotNull(message = "A unidade é obrigatória")
    private Long unidadeId;
    private Boolean ativo;
}
