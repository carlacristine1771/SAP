package br.com.sap.service;

import br.com.sap.dto.agenda.AgendaEventoRequestDTO;
import br.com.sap.dto.agenda.AgendaEventoResponseDTO;
import br.com.sap.entity.AgendaEvento;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoEventoAgenda;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.AgendaEventoRepository;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AgendaEventoService {

    private final AgendaEventoRepository agendaEventoRepository;
    private final UsuarioRepository usuarioRepository;
    private final UnidadeRepository unidadeRepository;

    public List<AgendaEventoResponseDTO> listarTodos() {
        Usuario logado = usuarioLogado();

        if (logado != null && logado.getTipoUsuario() == TipoUsuario.PSICOLOGO) {
            return agendaEventoRepository
                    .findByPsicologoIdOrderByDataInicioAsc(logado.getId())
                    .stream()
                    .map(this::converterParaDTO)
                    .toList();
        }

        if (logado != null && logado.getUnidade() != null) {
            return agendaEventoRepository
                    .findByUnidadeIdOrderByDataInicioAsc(logado.getUnidade().getId())
                    .stream()
                    .map(this::converterParaDTO)
                    .toList();
        }

        return agendaEventoRepository
                .findAllByOrderByDataInicioAsc()
                .stream()
                .map(this::converterParaDTO)
                .toList();
    }

    public List<AgendaEventoResponseDTO> listarPorPeriodo(
            LocalDate inicio,
            LocalDate fim
    ) {
        LocalDateTime inicioPeriodo = inicio.atStartOfDay();
        LocalDateTime fimPeriodo = fim.plusDays(1).atStartOfDay().minusNanos(1);

        Usuario logado = usuarioLogado();

        if (logado != null && logado.getTipoUsuario() == TipoUsuario.PSICOLOGO) {
            return agendaEventoRepository
                    .findByPsicologoIdAndDataInicioBetweenOrderByDataInicioAsc(
                            logado.getId(),
                            inicioPeriodo,
                            fimPeriodo
                    )
                    .stream()
                    .map(this::converterParaDTO)
                    .toList();
        }

        if (logado != null && logado.getUnidade() != null) {
            return agendaEventoRepository
                    .findByUnidadeIdAndDataInicioBetweenOrderByDataInicioAsc(
                            logado.getUnidade().getId(),
                            inicioPeriodo,
                            fimPeriodo
                    )
                    .stream()
                    .map(this::converterParaDTO)
                    .toList();
        }

        return agendaEventoRepository
                .findByDataInicioBetweenOrderByDataInicioAsc(
                        inicioPeriodo,
                        fimPeriodo
                )
                .stream()
                .map(this::converterParaDTO)
                .toList();
    }

    public AgendaEventoResponseDTO criar(AgendaEventoRequestDTO dto) {
        validarDatas(dto.getDataInicio(), dto.getDataFim());

        Usuario logado = usuarioLogado();

        Usuario psicologo = resolverPsicologo(dto.getPsicologoId(), logado);
        Unidade unidade = resolverUnidade(dto.getUnidadeId(), psicologo, logado);

        AgendaEvento evento = AgendaEvento.builder()
                .titulo(dto.getTitulo().trim())
                .descricao(normalizarTexto(dto.getDescricao()))
                .tipo(normalizarTipo(dto.getTipo()))
                .dataInicio(dto.getDataInicio())
                .dataFim(dto.getDataFim())
                .diaInteiro(dto.getDiaInteiro() != null ? dto.getDiaInteiro() : false)
                .cor(normalizarTexto(dto.getCor()))
                .psicologo(psicologo)
                .unidade(unidade)
                .build();

        agendaEventoRepository.save(evento);

        return converterParaDTO(evento);
    }

    public AgendaEventoResponseDTO atualizar(
            Long id,
            AgendaEventoRequestDTO dto
    ) {
        validarDatas(dto.getDataInicio(), dto.getDataFim());

        AgendaEvento evento = buscarEvento(id);

        Usuario logado = usuarioLogado();

        Usuario psicologo = resolverPsicologo(dto.getPsicologoId(), logado);
        Unidade unidade = resolverUnidade(dto.getUnidadeId(), psicologo, logado);

        evento.setTitulo(dto.getTitulo().trim());
        evento.setDescricao(normalizarTexto(dto.getDescricao()));
        evento.setTipo(normalizarTipo(dto.getTipo()));
        evento.setDataInicio(dto.getDataInicio());
        evento.setDataFim(dto.getDataFim());
        evento.setDiaInteiro(dto.getDiaInteiro() != null ? dto.getDiaInteiro() : false);
        evento.setCor(normalizarTexto(dto.getCor()));
        evento.setPsicologo(psicologo);
        evento.setUnidade(unidade);

        agendaEventoRepository.save(evento);

        return converterParaDTO(evento);
    }

    public void deletar(Long id) {
        AgendaEvento evento = buscarEvento(id);
        agendaEventoRepository.delete(evento);
    }

    private AgendaEvento buscarEvento(Long id) {
        return agendaEventoRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Evento de agenda não encontrado"
                        )
                );
    }

    private void validarDatas(
            LocalDateTime dataInicio,
            LocalDateTime dataFim
    ) {
        if (dataInicio == null) {
            throw new BusinessRuleException("A data de início é obrigatória");
        }

        if (dataFim != null && dataFim.isBefore(dataInicio)) {
            throw new BusinessRuleException(
                    "A data final não pode ser anterior à data inicial"
            );
        }
    }

    private Usuario resolverPsicologo(
            Long psicologoId,
            Usuario logado
    ) {
        if (psicologoId != null) {
            return usuarioRepository.findById(psicologoId)
                    .filter(usuario -> usuario.getTipoUsuario() == TipoUsuario.PSICOLOGO)
                    .orElseThrow(() ->
                            new ResourceNotFoundException(
                                    "Psicólogo(a) não encontrado(a)"
                            )
                    );
        }

        if (logado != null && logado.getTipoUsuario() == TipoUsuario.PSICOLOGO) {
            return logado;
        }

        throw new BusinessRuleException(
                "Informe o psicólogo responsável pelo evento"
        );
    }

    private Unidade resolverUnidade(
            Long unidadeId,
            Usuario psicologo,
            Usuario logado
    ) {
        if (unidadeId != null) {
            return unidadeRepository.findById(unidadeId)
                    .orElseThrow(() ->
                            new ResourceNotFoundException(
                                    "Unidade não encontrada"
                            )
                    );
        }

        if (psicologo != null && psicologo.getUnidade() != null) {
            return psicologo.getUnidade();
        }

        if (logado != null && logado.getUnidade() != null) {
            return logado.getUnidade();
        }

        return null;
    }

    private TipoEventoAgenda normalizarTipo(String tipo) {
        if (tipo == null || tipo.isBlank()) {
            return TipoEventoAgenda.OUTRO;
        }

        String valor = tipo.trim()
                .toUpperCase()
                .replace("Ã", "A")
                .replace("Á", "A")
                .replace("À", "A")
                .replace("Â", "A")
                .replace("É", "E")
                .replace("Ê", "E")
                .replace("Í", "I")
                .replace("Ó", "O")
                .replace("Ô", "O")
                .replace("Õ", "O")
                .replace("Ú", "U")
                .replace("Ç", "C")
                .replace("-", "_")
                .replace(" ", "_");

        return switch (valor) {
            case "ATENDIMENTO" -> TipoEventoAgenda.ATENDIMENTO;
            case "REUNIAO", "REUNIAO_COM_COORDENACAO" -> TipoEventoAgenda.REUNIAO;
            case "LEMBRETE" -> TipoEventoAgenda.LEMBRETE;
            case "BLOQUEIO", "BLOQUEIO_DE_HORARIO" -> TipoEventoAgenda.BLOQUEIO;
            case "OBSERVACAO" -> TipoEventoAgenda.OBSERVACAO;
            default -> TipoEventoAgenda.OUTRO;
        };
    }

    private String normalizarTexto(String texto) {
        if (texto == null) {
            return null;
        }

        String valor = texto.trim();

        return valor.isBlank() ? null : valor;
    }

    private Usuario usuarioLogado() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        String email = authentication.getName();

        if (email == null || "anonymousUser".equals(email)) {
            return null;
        }

        return usuarioRepository.findByEmail(email).orElse(null);
    }

    private AgendaEventoResponseDTO converterParaDTO(AgendaEvento evento) {
        return AgendaEventoResponseDTO.builder()
                .id(evento.getId())
                .titulo(evento.getTitulo())
                .descricao(evento.getDescricao())
                .tipo(evento.getTipo())
                .dataInicio(evento.getDataInicio())
                .dataFim(evento.getDataFim())
                .diaInteiro(evento.getDiaInteiro())
                .cor(evento.getCor())
                .psicologoId(evento.getPsicologo() != null ? evento.getPsicologo().getId() : null)
                .psicologo(evento.getPsicologo() != null ? evento.getPsicologo().getNome() : null)
                .unidadeId(evento.getUnidade() != null ? evento.getUnidade().getId() : null)
                .unidade(evento.getUnidade() != null ? evento.getUnidade().getNome() : null)
                .createdAt(evento.getCreatedAt() != null ? evento.getCreatedAt().toString() : null)
                .updatedAt(evento.getUpdatedAt() != null ? evento.getUpdatedAt().toString() : null)
                .build();
    }
}