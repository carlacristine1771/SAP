package br.com.sap.service;

import br.com.sap.dto.turma.*;
import br.com.sap.entity.*;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.util.List;

@Service @RequiredArgsConstructor
public class TurmaService {
    private final TurmaRepository turmaRepository;
    private final CursoRepository cursoRepository;
    private final UnidadeRepository unidadeRepository;
    private final UsuarioRepository usuarioRepository;

    public List<TurmaDTO> listar(Long unidadeId, Authentication authentication) {
        Usuario logado = buscarUsuarioLogado(authentication);
        List<Turma> turmas;
        if (logado != null && logado.getTipoUsuario() == TipoUsuario.INSTRUTOR) {
            turmas = turmaRepository.findByInstrutorAndAtivoTrueOrderByNomeAsc(logado);
        } else if (logado != null && (logado.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null)) && logado.getUnidade() != null) {
            turmas = turmaRepository.findByUnidadeAndAtivoTrueOrderByNomeAsc(logado.getUnidade());
        } else if (unidadeId != null) {
            turmas = turmaRepository.findByUnidadeAndAtivoTrueOrderByNomeAsc(buscarUnidade(unidadeId));
        } else {
            turmas = turmaRepository.findByAtivoTrueOrderByNomeAsc();
        }
        return turmas.stream().map(this::toDTO).toList();
    }

    public TurmaDTO buscarPorId(Long id) { return toDTO(buscarTurma(id)); }

    public TurmaDTO criar(TurmaRequestDTO dto) {
        return criar(dto, null);
    }

    public TurmaDTO criar(TurmaRequestDTO dto, Authentication authentication) {
        Curso curso = buscarCurso(dto.getCursoId());
        Unidade unidade = unidadePermitida(dto.getUnidadeId(), authentication);
        if (curso.getUnidade() != null && !curso.getUnidade().getId().equals(unidade.getId())) {
            throw new BusinessRuleException("O curso selecionado não pertence à unidade informada.");
        }
        Usuario instrutor = dto.getInstrutorId()==null?null:buscarUsuario(dto.getInstrutorId());
        if (instrutor != null && instrutor.getTipoUsuario() != TipoUsuario.INSTRUTOR) throw new BusinessRuleException("O responsável da turma precisa ser instrutor");
        if (instrutor != null && instrutor.getUnidade() != null && !instrutor.getUnidade().getId().equals(unidade.getId())) throw new BusinessRuleException("O instrutor selecionado não pertence à unidade da turma.");
        String nomeTurma = dto.getNome() == null ? "" : dto.getNome().trim();
        if (turmaRepository.existsByNomeIgnoreCaseAndUnidadeAndAtivoTrue(nomeTurma, unidade)) {
            throw new BusinessRuleException("Já existe uma turma ativa com esse nome nesta unidade.");
        }
        Turma turma = Turma.builder().nome(nomeTurma).turno(dto.getTurno()).curso(curso).unidade(unidade).instrutor(instrutor)
                .ativo(dto.getAtivo()==null || dto.getAtivo()).build();
        return toDTO(turmaRepository.save(turma));
    }

    public TurmaDTO atualizar(Long id, TurmaRequestDTO dto) {
        return atualizar(id, dto, null);
    }

    public TurmaDTO atualizar(Long id, TurmaRequestDTO dto, Authentication authentication) {
        Turma turma = buscarTurma(id);
        validarTurmaDaUnidade(turma, authentication);
        String nomeTurma = dto.getNome() == null ? "" : dto.getNome().trim();
        Curso curso = buscarCurso(dto.getCursoId());
        Unidade unidade = unidadePermitida(dto.getUnidadeId(), authentication);
        if (curso.getUnidade() != null && !curso.getUnidade().getId().equals(unidade.getId())) {
            throw new BusinessRuleException("O curso selecionado não pertence à unidade informada.");
        }
        Usuario instrutor = dto.getInstrutorId()==null?null:buscarUsuario(dto.getInstrutorId());
        if (instrutor != null && instrutor.getTipoUsuario() != TipoUsuario.INSTRUTOR) throw new BusinessRuleException("O responsável da turma precisa ser instrutor");
        if (instrutor != null && instrutor.getUnidade() != null && !instrutor.getUnidade().getId().equals(unidade.getId())) throw new BusinessRuleException("O instrutor selecionado não pertence à unidade da turma.");
        if (turmaRepository.existsByNomeIgnoreCaseAndUnidadeAndAtivoTrueAndIdNot(nomeTurma, unidade, turma.getId())) {
            throw new BusinessRuleException("Já existe uma turma ativa com esse nome nesta unidade.");
        }
        turma.setNome(nomeTurma);
        turma.setTurno(dto.getTurno());
        turma.setCurso(curso);
        turma.setUnidade(unidade);
        turma.setInstrutor(instrutor);
        if (dto.getAtivo()!=null) turma.setAtivo(dto.getAtivo());
        return toDTO(turmaRepository.save(turma));
    }

    public void deletar(Long id) { Turma turma=buscarTurma(id); turma.setAtivo(false); turmaRepository.save(turma); }

        private Unidade unidadePermitida(Long unidadeId, Authentication authentication) {
        Usuario logado = buscarUsuarioLogado(authentication);
        if (logado != null && (logado.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null))) {
            if (logado.getUnidade() == null) throw new BusinessRuleException("Administrador da unidade sem unidade vinculada.");
            return logado.getUnidade();
        }
        return buscarUnidade(unidadeId);
    }

    private void validarTurmaDaUnidade(Turma turma, Authentication authentication) {
        Usuario logado = buscarUsuarioLogado(authentication);
        if (logado != null && (logado.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null))) {
            Long unidadeLogado = logado.getUnidade() != null ? logado.getUnidade().getId() : null;
            Long unidadeTurma = turma.getUnidade() != null ? turma.getUnidade().getId() : null;
            if (unidadeLogado == null || unidadeTurma == null || !unidadeLogado.equals(unidadeTurma)) {
                throw new BusinessRuleException("Administrador da unidade só pode alterar turmas da própria unidade.");
            }
        }
    }

    private Curso buscarCurso(Long id){ return cursoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Curso não encontrado")); }
    private Turma buscarTurma(Long id){ return turmaRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Turma não encontrada")); }
    private Unidade buscarUnidade(Long id){ return unidadeRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Unidade não encontrada")); }
    private Usuario buscarUsuario(Long id){ return usuarioRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado")); }
    private Usuario buscarUsuarioLogado(Authentication auth){ if(auth==null) return null; return usuarioRepository.findByEmail(auth.getName()).orElse(null); }
    private TurmaDTO toDTO(Turma t){ return TurmaDTO.builder().id(t.getId()).nome(t.getNome()).turno(t.getTurno()).ativo(t.getAtivo())
            .cursoId(t.getCurso()!=null?t.getCurso().getId():null).curso(t.getCurso()!=null?t.getCurso().getNome():null)
            .unidadeId(t.getUnidade()!=null?t.getUnidade().getId():null).unidade(t.getUnidade()!=null?t.getUnidade().getNome():null)
            .instrutorId(t.getInstrutor()!=null?t.getInstrutor().getId():null).instrutor(t.getInstrutor()!=null?t.getInstrutor().getNome():null)
            .createdAt(t.getCreatedAt()!=null?t.getCreatedAt().toString():null).build(); }
}
