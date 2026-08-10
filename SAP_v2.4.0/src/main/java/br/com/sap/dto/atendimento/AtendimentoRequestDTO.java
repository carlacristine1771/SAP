package br.com.sap.dto.atendimento;

import jakarta.validation.constraints.FutureOrPresent;
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
public class AtendimentoRequestDTO {

    @NotBlank(message = "O título é obrigatório")
    private String titulo;

    @NotBlank(message = "A descrição é obrigatória")
    private String descricao;

    @NotNull(message = "A data do atendimento é obrigatória")
    @FutureOrPresent(message = "A data não pode ser no passado")
    private LocalDateTime dataAtendimento;

    private String observacoes;

    /**
     * Relatório da consulta escrito pela psicóloga.
     */
    private String relatorioConsulta;

    /**
     * Tipo de atendimento/agendamento: dentro, fora ou remoto.
     */
    private String tipoAtendimento;

    /**
     * Classificação final da consulta escolhida pela psicóloga.
     * Alimenta o gráfico de Tipos de Atendimento.
     */
    private String categoriaAtendimento;

    @NotNull(message = "O aluno é obrigatório")
    private Long alunoId;

    private Long psicologoId;

    private Long solicitanteId;
}