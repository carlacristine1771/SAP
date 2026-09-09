package br.com.sap.dto.agenda;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgendaEventoRequestDTO {

    @NotBlank(message = "O título é obrigatório")
    private String titulo;

    private String descricao;

    /**
     * Valores aceitos:
     * ATENDIMENTO, REUNIAO, LEMBRETE, BLOQUEIO, OBSERVACAO, OUTRO
     */
    private String tipo;

    @NotNull(message = "A data de início é obrigatória")
    private LocalDateTime dataInicio;

    private LocalDateTime dataFim;

    private Boolean diaInteiro;

    private String cor;

    private Long psicologoId;

    private Long unidadeId;
}