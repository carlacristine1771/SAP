package br.com.sap.dto.curso;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CursoDTO {
    private Long id;
    private String nome;
    private String tipoAprendizagem;
    private String descricao;
    private Boolean ativo;
    private Long unidadeId;
    private String unidade;
    private String createdAt;
}
