package br.com.sap.service;

import br.com.sap.dto.curso.*;
import br.com.sap.entity.Curso;
import br.com.sap.entity.Unidade;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.CursoRepository;
import br.com.sap.repository.UnidadeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.util.List;

@Service @RequiredArgsConstructor
public class CursoService {
    private final CursoRepository cursoRepository;
    private final UnidadeRepository unidadeRepository;
    private final br.com.sap.repository.UsuarioRepository usuarioRepository;

    public List<CursoDTO> listar(Long unidadeId) {
        List<Curso> cursos = unidadeId == null
                ? cursoRepository.findByAtivoTrueOrderByNomeAsc()
                : cursoRepository.findByUnidadeAndAtivoTrueOrderByNomeAsc(buscarUnidade(unidadeId));
        return cursos.stream().map(this::toDTO).toList();
    }

    public List<CursoDTO> listar(Long unidadeId, Authentication authentication) {
        br.com.sap.entity.Usuario logado = buscarLogado(authentication);
        if (logado != null && (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null)) && logado.getUnidade() != null) {
            unidadeId = logado.getUnidade().getId();
        }
        return listar(unidadeId);
    }

    public CursoDTO buscarPorId(Long id) { return toDTO(buscarCurso(id)); }

    public CursoDTO criar(CursoRequestDTO dto) {
        return criar(dto, null);
    }

    public CursoDTO criar(CursoRequestDTO dto, Authentication authentication) {
        Unidade unidade = buscarUnidade(unidadePermitida(dto.getUnidadeId(), authentication));
        if (cursoRepository.existsByNomeIgnoreCaseAndUnidade(dto.getNome().trim(), unidade)) {
            throw new BusinessRuleException("Já existe curso com esse nome nessa unidade");
        }
        Curso curso = Curso.builder()
                .nome(dto.getNome().trim())
                .tipoAprendizagem(dto.getTipoAprendizagem())
                .descricao(dto.getDescricao())
                .unidade(unidade)
                .ativo(dto.getAtivo() == null || dto.getAtivo()).build();
        return toDTO(cursoRepository.save(curso));
    }

    public CursoDTO atualizar(Long id, CursoRequestDTO dto) {
        return atualizar(id, dto, null);
    }

    public CursoDTO atualizar(Long id, CursoRequestDTO dto, Authentication authentication) {
        Curso curso = buscarCurso(id);
        Unidade unidade = buscarUnidade(unidadePermitida(dto.getUnidadeId(), authentication));
        validarCursoDaUnidade(curso, unidade, authentication);
        curso.setNome(dto.getNome().trim());
        curso.setTipoAprendizagem(dto.getTipoAprendizagem());
        curso.setDescricao(dto.getDescricao());
        curso.setUnidade(unidade);
        if (dto.getAtivo() != null) curso.setAtivo(dto.getAtivo());
        return toDTO(cursoRepository.save(curso));
    }

    public void deletar(Long id) {
        Curso curso = buscarCurso(id);
        curso.setAtivo(false);
        cursoRepository.save(curso);
    }

        private Long unidadePermitida(Long unidadeId, Authentication authentication) {
        br.com.sap.entity.Usuario logado = buscarLogado(authentication);
        if (logado != null && (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null))) {
            if (logado.getUnidade() == null) throw new BusinessRuleException("Administrador da unidade sem unidade vinculada.");
            return logado.getUnidade().getId();
        }
        return unidadeId;
    }

    private void validarCursoDaUnidade(Curso curso, Unidade unidade, Authentication authentication) {
        br.com.sap.entity.Usuario logado = buscarLogado(authentication);
        if (logado != null && (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null))) {
            Long unidadeCurso = curso.getUnidade() != null ? curso.getUnidade().getId() : null;
            if (unidadeCurso == null || !unidadeCurso.equals(unidade.getId())) {
                throw new BusinessRuleException("Administrador da unidade só pode alterar cursos da própria unidade.");
            }
        }
    }

    private br.com.sap.entity.Usuario buscarLogado(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return usuarioRepository.findByEmail(authentication.getName()).orElse(null);
    }

    private Curso buscarCurso(Long id) {
        return cursoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Curso não encontrado"));
    }
    private Unidade buscarUnidade(Long id) {
        return unidadeRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Unidade não encontrada"));
    }
    private CursoDTO toDTO(Curso c) {
        return CursoDTO.builder()
                .id(c.getId())
                .nome(c.getNome())
                .tipoAprendizagem(c.getTipoAprendizagem())
                .descricao(c.getDescricao())
                .ativo(c.getAtivo())
                .unidadeId(c.getUnidade()!=null?c.getUnidade().getId():null)
                .unidade(c.getUnidade()!=null?c.getUnidade().getNome():null)
                .createdAt(c.getCreatedAt()!=null?c.getCreatedAt().toString():null)
                .build();
    }
}
