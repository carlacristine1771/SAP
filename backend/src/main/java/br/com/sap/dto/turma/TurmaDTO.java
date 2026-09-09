package br.com.sap.dto.turma;

import br.com.sap.entity.enums.Turno;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TurmaDTO {
    private Long id;
    private String nome;
    private Turno turno;
    private Boolean ativo;
    private Long cursoId;
    private String curso;
    private Long unidadeId;
    private String unidade;
    private Long instrutorId;
    private String instrutor;
    private String createdAt;
}
