package br.com.sap.service;

import br.com.sap.dto.usuario.UsuarioUpdateDTO;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.UsuarioPermissions;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final UnidadeRepository unidadeRepository;
    private final PasswordEncoder passwordEncoder;
    private final UsuarioPermissions permissions;

    public List<Usuario> listarTodos(Authentication authentication) {
        Usuario logado = permissions.authenticated(authentication);
        if (!permissions.isUnitAdmin(logado)) {
            return usuarioRepository.findByAtivoTrue();
        }
        Long unidadeId = permissions.unitId(logado);
        // These reads also supply chat recipients and instructor selectors.
        return unidadeId == null ? List.of() : usuarioRepository.findByUnidadeIdAndAtivoTrue(unidadeId);
    }

    public Usuario buscarPorId(Long id, Authentication authentication) {
        Usuario logado = permissions.authenticated(authentication);
        Usuario usuario = buscarUsuario(id);
        permissions.requireRead(logado, usuario);
        return usuario;
    }

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }

    @Transactional
    public Usuario atualizar(Long id, UsuarioUpdateDTO dto, Authentication authentication) {
        Usuario logado = permissions.authenticated(authentication);
        Usuario usuario = buscarUsuario(id);
        permissions.requireUpdate(logado, usuario, dto.getTipoUsuario(), dto.getUnidadeId());

        Unidade unidade = null;
        Long unidadeIdAlvo = dto.getUnidadeId();
        if (unidadeIdAlvo == null && dto.getTipoUsuario() != TipoUsuario.ADMINISTRADOR) {
            throw new BusinessRuleException("A unidade é obrigatória para este perfil.");
        }

        if (unidadeIdAlvo != null) {
            unidade = unidadeRepository.findById(unidadeIdAlvo)
                    .orElseThrow(() -> new ResourceNotFoundException("Unidade não encontrada"));
        }

        String email = dto.getEmail() == null ? "" : dto.getEmail().trim();
        String loginUsuario = dto.getUsuario() == null ? "" : dto.getUsuario().trim();
        validarDuplicidadeUsuario(usuario.getId(), email, loginUsuario);
        liberarCredenciaisDeUsuariosInativos(usuario.getId(), email, loginUsuario);

        usuario.setNome(dto.getNome() == null ? null : dto.getNome().trim());
        usuario.setEmail(email);
        usuario.setUsuario(loginUsuario.isBlank() ? null : loginUsuario);
        TipoUsuario tipoParaSalvar = dto.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE ? TipoUsuario.ADMINISTRADOR : dto.getTipoUsuario();
        usuario.setTipoUsuario(tipoParaSalvar);
        usuario.setUnidade(unidade);

        if (dto.getSenha() != null && !dto.getSenha().isBlank()) {
            usuario.setSenha(passwordEncoder.encode(dto.getSenha()));
        }

        return usuarioRepository.save(usuario);
    }

    @Transactional
    public void deletar(Long id, Authentication authentication) {
        Usuario logado = permissions.authenticated(authentication);
        Usuario usuario = buscarUsuario(id);
        permissions.requireDelete(logado, usuario);
        if (logado != null && logado.getId() != null && logado.getId().equals(usuario.getId())) {
            throw new BusinessRuleException("Você não pode excluir o próprio login em uso.");
        }

        /*
         * Exclusão lógica: evita erro de chave estrangeira em atendimentos/chat
         * e libera o e-mail/login para novo cadastro.
         */
        String marcador = "__excluido_" + usuario.getId() + "_" + System.currentTimeMillis() + "__";
        usuario.setAtivo(false);
        usuario.setEmail(marcador + (usuario.getEmail() == null ? "sem_email@sap.local" : usuario.getEmail()));
        usuario.setUsuario(marcador + (usuario.getUsuario() == null ? "sem_usuario" : usuario.getUsuario()));
        usuarioRepository.save(usuario);
    }


    private void validarDuplicidadeUsuario(Long idAtual, String email, String loginUsuario) {
        if (email != null && !email.isBlank()) {
            usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(email).ifPresent(u -> {
                if (!u.getId().equals(idAtual)) {
                    throw new BusinessRuleException("E-mail já cadastrado");
                }
            });
        }
        if (loginUsuario != null && !loginUsuario.isBlank()) {
            usuarioRepository.findByUsuarioIgnoreCaseAndAtivoTrue(loginUsuario).ifPresent(u -> {
                if (!u.getId().equals(idAtual)) {
                    throw new BusinessRuleException("Usuário já cadastrado");
                }
            });
        }
    }


    private void liberarCredenciaisDeUsuariosInativos(Long idAtual, String email, String loginUsuario) {
        if (email != null && !email.isBlank()) {
            usuarioRepository.findByEmail(email).ifPresent(u -> {
                if (!u.getId().equals(idAtual) && !Boolean.TRUE.equals(u.getAtivo())) {
                    anonimizarUsuarioInativo(u);
                }
            });
        }
        if (loginUsuario != null && !loginUsuario.isBlank()) {
            usuarioRepository.findByUsuario(loginUsuario).ifPresent(u -> {
                if (!u.getId().equals(idAtual) && !Boolean.TRUE.equals(u.getAtivo())) {
                    anonimizarUsuarioInativo(u);
                }
            });
        }
    }

    private void anonimizarUsuarioInativo(Usuario usuario) {
        String marcador = "__excluido_" + usuario.getId() + "_" + System.currentTimeMillis() + "__";
        usuario.setEmail(marcador + (usuario.getEmail() == null ? "sem_email@sap.local" : usuario.getEmail()));
        usuario.setUsuario(marcador + (usuario.getUsuario() == null ? "sem_usuario" : usuario.getUsuario()));
        usuarioRepository.save(usuario);
    }

}
