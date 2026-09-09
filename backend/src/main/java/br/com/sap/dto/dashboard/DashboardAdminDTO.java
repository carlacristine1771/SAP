package br.com.sap.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardAdminDTO {

    private Long totalUsuarios;

    private Long totalAlunos;

    private Long totalAtendimentos;

    private Long atendimentosPendentes;

    private Long atendimentosFinalizados;

    private Long totalUnidades;
}