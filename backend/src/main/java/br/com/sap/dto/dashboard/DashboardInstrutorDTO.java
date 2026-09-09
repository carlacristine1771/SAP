package br.com.sap.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardInstrutorDTO {

    private Long totalAlunos;

    private Long alunosTurnoMatutino;

    private Long alunosTurnoVespertino;

    private Long alunosTurnoNoturno;
}