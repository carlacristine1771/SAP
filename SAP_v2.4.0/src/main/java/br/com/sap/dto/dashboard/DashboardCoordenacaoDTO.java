package br.com.sap.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardCoordenacaoDTO {

    private Long totalAlunos;

    private Long totalPsicologos;

    private Long atendimentosMes;

    private Long atendimentosPendentes;
}