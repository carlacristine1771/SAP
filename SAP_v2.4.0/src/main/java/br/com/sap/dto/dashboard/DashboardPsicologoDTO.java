package br.com.sap.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardPsicologoDTO {

    private Long meusAtendimentos;

    private Long atendimentosHoje;

    private Long atendimentosPendentes;

    private Long atendimentosFinalizados;
}