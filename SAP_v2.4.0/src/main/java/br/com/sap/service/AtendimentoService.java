package br.com.sap.service;

import br.com.sap.dto.atendimento.AtendimentoRequestDTO;
import br.com.sap.dto.atendimento.AtendimentoResponseDTO;
import br.com.sap.dto.atendimento.AtualizarStatusDTO;

import br.com.sap.entity.Aluno;
import br.com.sap.entity.Atendimento;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.StatusAtendimento;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.entity.enums.Turno;

import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;

import br.com.sap.repository.AlunoRepository;
import br.com.sap.repository.AtendimentoRepository;
import br.com.sap.repository.UsuarioRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AtendimentoService {

    private final AtendimentoRepository atendimentoRepository;
    private final AlunoRepository alunoRepository;
    private final UsuarioRepository usuarioRepository;

    public List<AtendimentoResponseDTO> listarTodos() {

        Usuario logado = usuarioLogado();
        if (logado != null && (logado.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null)) && logado.getUnidade() != null) {
            return atendimentoRepository.findByAlunoUnidadeId(logado.getUnidade().getId())
                .stream()
                .map(this::converterParaDTO)
                .toList();
        }

        return atendimentoRepository.findAll()
                .stream()
                .map(this::converterParaDTO)
                .toList();
    }

    public AtendimentoResponseDTO criar(
            AtendimentoRequestDTO dto
    ) {

        Aluno aluno = alunoRepository.findById(dto.getAlunoId())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Aluno não encontrado"
                        )
                );

        Usuario usuarioLogado = usuarioLogado();
        Usuario psicologo = buscarPsicologo(dto.getPsicologoId());

        Usuario solicitante = buscarSolicitante(dto.getSolicitanteId());
        if (solicitante == null && dto.getPsicologoId() != null && psicologo == null) {
            // Compatibilidade com versões antigas do frontend que enviavam o solicitante no campo psicologoId.
            solicitante = usuarioRepository.findById(dto.getPsicologoId()).orElse(null);
        }

        // Se a própria psicóloga criou o atendimento, ela é a solicitante e a profissional responsável.
        // Isso evita reaproveitar indevidamente o último coordenador/instrutor usado no navegador.
        if (usuarioLogado != null && usuarioLogado.getTipoUsuario() == TipoUsuario.PSICOLOGO) {
            solicitante = usuarioLogado;
            psicologo = usuarioLogado;
        }

        if (solicitante == null) {
            solicitante = usuarioLogado;
        }

        String tipoNormalizado = normalizarTipoAtendimento(dto.getTipoAtendimento());
        validarTipoHorarioAluno(aluno, dto.getDataAtendimento(), tipoNormalizado);
        validarConflitoHorario(null, psicologo, dto.getDataAtendimento(), StatusAtendimento.EM_ANDAMENTO);

        Atendimento atendimento = Atendimento.builder()
                .titulo(dto.getTitulo())
                .descricao(dto.getDescricao())
                .dataAtendimento(dto.getDataAtendimento())
                .observacoes(dto.getObservacoes())
                .relatorioConsulta(normalizarTexto(dto.getRelatorioConsulta()))
                .tipoAtendimento(tipoNormalizado)
                .categoriaAtendimento(normalizarCategoriaAtendimento(dto.getCategoriaAtendimento()))
                .aluno(aluno)
                .psicologo(psicologo)
                .solicitante(solicitante)
                .build();

        atendimentoRepository.save(atendimento);
        anexarRelatorioAoAluno(aluno, atendimento, null);

        return converterParaDTO(atendimento);
    }

    public AtendimentoResponseDTO atualizar(
            Long id,
            AtendimentoRequestDTO dto
    ) {

        Atendimento atendimento = buscarAtendimento(id);

        Aluno aluno = alunoRepository.findById(dto.getAlunoId())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Aluno não encontrado"
                        )
                );

        Usuario psicologo = buscarPsicologo(dto.getPsicologoId());
        String relatorioAnterior = atendimento.getRelatorioConsulta();

        String tipoNormalizado = normalizarTipoAtendimento(dto.getTipoAtendimento());
        validarTipoHorarioAluno(aluno, dto.getDataAtendimento(), tipoNormalizado);
        validarConflitoHorario(atendimento.getId(), psicologo, dto.getDataAtendimento(), atendimento.getStatus());

        atendimento.setTitulo(dto.getTitulo());
        atendimento.setDescricao(dto.getDescricao());
        atendimento.setDataAtendimento(dto.getDataAtendimento());
        atendimento.setObservacoes(dto.getObservacoes());
        atendimento.setRelatorioConsulta(normalizarTexto(dto.getRelatorioConsulta()));
        atendimento.setTipoAtendimento(tipoNormalizado);
        atendimento.setCategoriaAtendimento(normalizarCategoriaAtendimento(dto.getCategoriaAtendimento()));
        atendimento.setAluno(aluno);
        atendimento.setPsicologo(psicologo);
        Usuario solicitante = buscarSolicitante(dto.getSolicitanteId());
        if (solicitante == null && dto.getPsicologoId() != null && psicologo == null) {
            // Compatibilidade com registros antigos: ID não psicólogo deve ser solicitante, não profissional responsável.
            solicitante = usuarioRepository.findById(dto.getPsicologoId()).orElse(null);
        }
        if (solicitante != null) {
            atendimento.setSolicitante(solicitante);
        }

        atendimentoRepository.save(atendimento);
        anexarRelatorioAoAluno(aluno, atendimento, relatorioAnterior);

        return converterParaDTO(atendimento);
    }

    public AtendimentoResponseDTO atualizarStatus(
            Long id,
            AtualizarStatusDTO dto
    ) {

        Atendimento atendimento = buscarAtendimento(id);

        Usuario usuarioLogado = usuarioLogado();
        if (usuarioLogado != null
                && usuarioLogado.getTipoUsuario() == TipoUsuario.PSICOLOGO
                && dto.getStatus() == StatusAtendimento.EM_ANDAMENTO) {
            validarConflitoHorario(
                    atendimento.getId(),
                    usuarioLogado,
                    atendimento.getDataAtendimento(),
                    StatusAtendimento.EM_ANDAMENTO
            );
        }

        atendimento.setStatus(dto.getStatus());

        if (usuarioLogado != null
                && usuarioLogado.getTipoUsuario() == TipoUsuario.PSICOLOGO
                && (dto.getStatus() == StatusAtendimento.EM_ANDAMENTO
                    || dto.getStatus() == StatusAtendimento.FINALIZADO)) {
            atendimento.setPsicologo(usuarioLogado);
        }

        atendimentoRepository.save(atendimento);

        return converterParaDTO(atendimento);
    }

    private void validarConflitoHorario(
            Long atendimentoId,
            Usuario psicologo,
            java.time.LocalDateTime dataAtendimento,
            StatusAtendimento status
    ) {

        if (psicologo == null || dataAtendimento == null) {
            return;
        }

        if (status != StatusAtendimento.EM_ANDAMENTO) {
            return;
        }

        boolean existeConflito = atendimentoId == null
                ? atendimentoRepository.existsConflitoHorarioNovo(
                        psicologo,
                        dataAtendimento,
                        StatusAtendimento.EM_ANDAMENTO
                )
                : atendimentoRepository.existsConflitoHorario(
                        atendimentoId,
                        psicologo,
                        dataAtendimento,
                        StatusAtendimento.EM_ANDAMENTO
                );

        if (existeConflito) {
            throw new BusinessRuleException(
                    "Conflito de horário: este profissional já possui atendimento confirmado para essa data e horário."
            );
        }
    }


    private void validarTipoHorarioAluno(Aluno aluno, java.time.LocalDateTime dataAtendimento, String tipoAtendimento) {
        if (aluno == null || dataAtendimento == null) {
            return;
        }
        String tipo = tipoAtendimento == null || tipoAtendimento.isBlank() ? "dentro" : tipoAtendimento;
        if ("fora".equals(tipo) || "remoto".equals(tipo)) {
            return;
        }

        Turno turno = aluno.getTurno();
        if (turno == null) {
            return;
        }

        LocalTime hora = dataAtendimento.toLocalTime();
        LocalTime inicio;
        LocalTime fim;
        String label;
        switch (turno) {
            case MATUTINO -> { inicio = LocalTime.of(8, 0); fim = LocalTime.of(11, 59); label = "matutino"; }
            case VESPERTINO -> { inicio = LocalTime.of(13, 0); fim = LocalTime.of(17, 59); label = "vespertino"; }
            case NOTURNO -> { inicio = LocalTime.of(18, 0); fim = LocalTime.of(21, 59); label = "noturno"; }
            default -> { return; }
        }

        if (hora.isBefore(inicio) || hora.isAfter(fim)) {
            throw new BusinessRuleException(
                    "Horário fora do turno do aluno. Se for necessário agendar fora do horário do curso, selecione o tipo 'Fora do horário do curso'."
            );
        }
    }

    private String normalizarTexto(String texto) {

        if (texto == null) {
            return null;
        }

        String valor = texto.trim();
        return valor.isBlank() ? null : valor;
    }

    private void anexarRelatorioAoAluno(
            Aluno aluno,
            Atendimento atendimento,
            String relatorioAnterior
    ) {

        String relatorio = normalizarTexto(atendimento.getRelatorioConsulta());

        if (aluno == null || relatorio == null) {
            return;
        }

        if (relatorioAnterior != null && relatorioAnterior.trim().equals(relatorio)) {
            return;
        }

        String data = atendimento.getDataAtendimento() != null
                ? atendimento.getDataAtendimento().toLocalDate().toString()
                : java.time.LocalDate.now().toString();

        String profissional = atendimento.getPsicologo() != null
                ? atendimento.getPsicologo().getNome()
                : "Psicologia";

        String marcador = "Relatório da consulta #" + atendimento.getId();
        String bloco = "\n\n[" + marcador + " - " + data + " - " + profissional + "]\n" + relatorio;
        String observacoesAtuais = aluno.getObservacoes() == null ? "" : aluno.getObservacoes();

        if (observacoesAtuais.contains(marcador)) {
            return;
        }

        aluno.setObservacoes(observacoesAtuais + bloco);
        alunoRepository.save(aluno);
    }

    private String normalizarTipoAtendimento(String tipo) {

        if (tipo == null || tipo.isBlank()) {
            return null;
        }

        String valor = tipo.trim().toLowerCase();

        if (valor.equals("dentro") || valor.equals("dentro_horario") || valor.equals("dentro-do-horario")) {
            return "dentro";
        }

        if (valor.equals("fora") || valor.equals("fora_horario") || valor.equals("fora-do-horario")) {
            return "fora";
        }

        if (valor.equals("remoto") || valor.equals("online")) {
            return "remoto";
        }

        return valor;
    }

    private String normalizarCategoriaAtendimento(String categoria) {

        if (categoria == null || categoria.isBlank()) {
            return null;
        }

        String valor = categoria.trim().toLowerCase()
                .replace("á", "a")
                .replace("à", "a")
                .replace("ã", "a")
                .replace("â", "a")
                .replace("é", "e")
                .replace("ê", "e")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ô", "o")
                .replace("õ", "o")
                .replace("ú", "u")
                .replace("ç", "c")
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");

        if (valor.equals("atendimento_online") || valor.equals("online") || valor.equals("remoto")) {
            return "atendimento_online";
        }
        if (valor.equals("atendimento_presencial") || valor.equals("presencial")) {
            return "atendimento_presencial";
        }
        if (valor.equals("atendimento_familia") || valor.equals("familia") || valor.equals("atendimento_familiar")) {
            return "atendimento_familia";
        }
        if (valor.equals("acompanhamento_do_aluno") || valor.equals("acompanhamento_aluno") || valor.equals("acompanhamento")) {
            return "acompanhamento_do_aluno";
        }
        if (valor.equals("dinamica_de_grupo") || valor.equals("dinamica_grupo")) {
            return "dinamica_de_grupo";
        }
        if (valor.equals("saida_de_campo_oficinas_e_palestras")
                || valor.equals("saida_campo_oficinas_palestras")
                || valor.equals("saida_de_campo_oficinas_palestras")
                || valor.equals("oficinas_e_palestras")) {
            return "saida_campo_oficinas_palestras";
        }

        return "outros_atendimentos";
    }

    private Usuario usuarioLogado() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        String email = authentication.getName();

        if (email == null || "anonymousUser".equals(email)) {
            return null;
        }

        return usuarioRepository.findByEmail(email).orElse(null);
    }


    private Usuario buscarPsicologo(Long psicologoId) {

        if (psicologoId == null) {
            return null;
        }

        return usuarioRepository.findById(psicologoId)
                .filter(usuario -> usuario.getTipoUsuario() == TipoUsuario.PSICOLOGO)
                .orElse(null);
    }

    private Usuario buscarSolicitante(Long solicitanteId) {

        if (solicitanteId == null) {
            return null;
        }

        return usuarioRepository.findById(solicitanteId)
                .orElse(null);
    }

    private Atendimento buscarAtendimento(Long id) {

        return atendimentoRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Atendimento não encontrado"
                        )
                );
    }

    private AtendimentoResponseDTO converterParaDTO(
            Atendimento atendimento
    ) {

        Usuario psicologo = atendimento.getPsicologo();
        Usuario solicitante = atendimento.getSolicitante();

        // Se algum registro antigo estiver com coordenador/instrutor salvo em psicologo_id,
        // ele deve aparecer em "Solicitado por", e não como profissional responsável.
        if (psicologo != null && psicologo.getTipoUsuario() != TipoUsuario.PSICOLOGO) {
            if (solicitante == null) {
                solicitante = psicologo;
            }
            psicologo = null;
        }

        return AtendimentoResponseDTO.builder()
                .id(atendimento.getId())
                .titulo(atendimento.getTitulo())
                .descricao(atendimento.getDescricao())
                .dataAtendimento(atendimento.getDataAtendimento())
                .status(atendimento.getStatus())
                .observacoes(atendimento.getObservacoes())
                .relatorioConsulta(atendimento.getRelatorioConsulta())
                .tipoAtendimento(atendimento.getTipoAtendimento())
                .categoriaAtendimento(atendimento.getCategoriaAtendimento())
                .alunoId(atendimento.getAluno() != null ? atendimento.getAluno().getId() : null)
                .aluno(atendimento.getAluno() != null ? atendimento.getAluno().getNome() : null)
                .psicologoId(psicologo != null ? psicologo.getId() : null)
                .psicologo(psicologo != null ? psicologo.getNome() : null)
                .solicitanteId(solicitante != null ? solicitante.getId() : null)
                .solicitante(solicitante != null ? solicitante.getNome() : null)
                .createdAt(atendimento.getCreatedAt() != null ? atendimento.getCreatedAt().toString() : null)
                .build();
    }
}