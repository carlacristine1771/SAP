package br.com.sap.dto.agenda;

import br.com.sap.entity.enums.TipoEventoAgenda;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgendaEventoResponseDTO {

    private Long id;

    private String titulo;

    private String descricao;

    private TipoEventoAgenda tipo;

    private LocalDateTime dataInicio;

    private LocalDateTime dataFim;

    private Boolean diaInteiro;

    private String cor;

    private Long psicologoId;

    private String psicologo;

    private Long unidadeId;

    private String unidade;

    private String createdAt;

    private String updatedAt;
}