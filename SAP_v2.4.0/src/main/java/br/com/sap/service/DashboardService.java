package br.com.sap.service;

import br.com.sap.dto.dashboard.DashboardAdminDTO;
import br.com.sap.dto.dashboard.DashboardCoordenacaoDTO;
import br.com.sap.dto.dashboard.DashboardInstrutorDTO;
import br.com.sap.dto.dashboard.DashboardPsicologoDTO;

import br.com.sap.entity.enums.StatusAtendimento;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.entity.enums.Turno;

import br.com.sap.repository.AlunoRepository;
import br.com.sap.repository.AtendimentoRepository;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final UsuarioRepository usuarioRepository;
    private final AlunoRepository alunoRepository;
    private final AtendimentoRepository atendimentoRepository;
    private final UnidadeRepository unidadeRepository;

    public DashboardAdminDTO dashboardAdmin() {

        return DashboardAdminDTO.builder()

                .totalUsuarios(
                        (long) usuarioRepository.findAll().size()
                )

                .totalAlunos(
                        (long) alunoRepository.findAll().size()
                )

                .totalAtendimentos(
                        (long) atendimentoRepository.findAll().size()
                )

                .atendimentosPendentes(
                        atendimentoRepository.countByStatus(
                                StatusAtendimento.PENDENTE
                        )
                )

                .atendimentosFinalizados(
                        atendimentoRepository.countByStatus(
                                StatusAtendimento.FINALIZADO
                        )
                )

                .totalUnidades(
                        (long) unidadeRepository.findAll().size()
                )

                .build();
    }

    public DashboardPsicologoDTO dashboardPsicologo() {

        LocalDateTime inicioHoje =
                LocalDateTime.now()
                        .withHour(0)
                        .withMinute(0)
                        .withSecond(0);

        LocalDateTime fimHoje =
                LocalDateTime.now()
                        .withHour(23)
                        .withMinute(59)
                        .withSecond(59);

        return DashboardPsicologoDTO.builder()

                .meusAtendimentos(
                        (long) atendimentoRepository.findAll().size()
                )

                .atendimentosHoje(
                        atendimentoRepository
                                .countByDataAtendimentoBetween(
                                        inicioHoje,
                                        fimHoje
                                )
                )

                .atendimentosPendentes(
                        atendimentoRepository.countByStatus(
                                StatusAtendimento.PENDENTE
                        )
                )

                .atendimentosFinalizados(
                        atendimentoRepository.countByStatus(
                                StatusAtendimento.FINALIZADO
                        )
                )

                .build();
    }

    public DashboardCoordenacaoDTO dashboardCoordenacao() {

        LocalDateTime inicioMes =
                LocalDateTime.now()
                        .withDayOfMonth(1)
                        .withHour(0)
                        .withMinute(0)
                        .withSecond(0);

        LocalDateTime fimMes =
                LocalDateTime.now()
                        .withDayOfMonth(
                                LocalDateTime.now()
                                        .toLocalDate()
                                        .lengthOfMonth()
                        )
                        .withHour(23)
                        .withMinute(59)
                        .withSecond(59);

        return DashboardCoordenacaoDTO.builder()

                .totalAlunos(
                        (long) alunoRepository.findAll().size()
                )

                .totalPsicologos(
                        (long) usuarioRepository
                                .findByTipoUsuario(
                                        TipoUsuario.PSICOLOGO
                                )
                                .size()
                )

                .atendimentosMes(
                        atendimentoRepository
                                .countByDataAtendimentoBetween(
                                        inicioMes,
                                        fimMes
                                )
                )

                .atendimentosPendentes(
                        atendimentoRepository.countByStatus(
                                StatusAtendimento.PENDENTE
                        )
                )

                .build();
    }

    public DashboardInstrutorDTO dashboardInstrutor() {

        return DashboardInstrutorDTO.builder()

                .totalAlunos(
                        (long) alunoRepository.findAll().size()
                )

                .alunosTurnoMatutino(
                        (long) alunoRepository
                                .findByTurno(Turno.MATUTINO)
                                .size()
                )

                .alunosTurnoVespertino(
                        (long) alunoRepository
                                .findByTurno(Turno.VESPERTINO)
                                .size()
                )

                .alunosTurnoNoturno(
                        (long) alunoRepository
                                .findByTurno(Turno.NOTURNO)
                                .size()
                )

                .build();
    }
}