package br.com.sap.dto.atendimento;

import br.com.sap.entity.enums.StatusAtendimento;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AtendimentoResponseDTO {

    private Long id;

    private String titulo;

    private String descricao;

    private LocalDateTime dataAtendimento;

    private StatusAtendimento status;

    private String observacoes;

    private String relatorioConsulta;

    private String tipoAtendimento;

    private String categoriaAtendimento;

    private Long alunoId;

    private String aluno;

    private Long psicologoId;

    private String psicologo;

    private Long solicitanteId;

    private String solicitante;

    private String createdAt;
}