package br.com.sap.service;

import br.com.sap.dto.auth.ChangePasswordDTO;
import br.com.sap.dto.auth.LoginRequestDTO;
import br.com.sap.dto.auth.LoginResponseDTO;
import br.com.sap.dto.auth.RegisterRequestDTO;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final UnidadeRepository unidadeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public LoginResponseDTO login(LoginRequestDTO dto) {
        Usuario usuario = buscarPorIdentificador(dto.getEmail());

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        usuario.getEmail(),
                        dto.getSenha()
                )
        );

        String token = jwtService.generateToken(usuario);

        return LoginResponseDTO.builder()
                .token(token)
                .id(usuario.getId())
                .nome(usuario.getNome())
                .email(usuario.getEmail())
                .usuario(usuario.getUsuario())
                .tipoUsuario(usuario.getTipoUsuario())
                .unidadeId(usuario.getUnidade() != null ? usuario.getUnidade().getId() : null)
                .unidade(usuario.getUnidade() != null ? usuario.getUnidade().getNome() : null)
                .senhaTemporaria(usuario.getSenhaTemporaria())
                .build();
    }

    public LoginResponseDTO me(Authentication authentication) {
        if (authentication == null) {
            throw new ResourceNotFoundException("Sessão não encontrada");
        }

        Usuario usuario = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        return LoginResponseDTO.builder()
                .id(usuario.getId())
                .nome(usuario.getNome())
                .email(usuario.getEmail())
                .usuario(usuario.getUsuario())
                .tipoUsuario(usuario.getTipoUsuario())
                .unidadeId(usuario.getUnidade() != null ? usuario.getUnidade().getId() : null)
                .unidade(usuario.getUnidade() != null ? usuario.getUnidade().getNome() : null)
                .senhaTemporaria(usuario.getSenhaTemporaria())
                .build();
    }

    public void register(RegisterRequestDTO dto) {
        register(dto, null);
    }

    public void register(RegisterRequestDTO dto, Authentication authentication) {
        String email = dto.getEmail() == null ? "" : dto.getEmail().trim();
        String loginUsuario = dto.getUsuario() == null ? "" : dto.getUsuario().trim();

        if (usuarioRepository.existsByEmailIgnoreCaseAndAtivoTrue(email)) {
            throw new BusinessRuleException("E-mail já cadastrado");
        }
        if (!loginUsuario.isBlank() && usuarioRepository.existsByUsuarioIgnoreCaseAndAtivoTrue(loginUsuario)) {
            throw new BusinessRuleException("Usuário já cadastrado");
        }
        liberarCredenciaisDeUsuariosInativos(email, loginUsuario);

        Usuario logado = authentication == null ? null : usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(authentication.getName()).orElse(null);
        Long unidadeId = dto.getUnidadeId();
        br.com.sap.entity.enums.TipoUsuario tipoParaSalvar = dto.getTipoUsuario();

        if (isAdminUnidade(logado)) {
            if (isAdministradorGeralSolicitado(dto.getTipoUsuario(), dto.getUnidadeId())) {
                throw new BusinessRuleException("Administrador da unidade não pode criar administrador geral.");
            }
            if (logado.getUnidade() == null) {
                throw new BusinessRuleException("Administrador da unidade sem unidade vinculada.");
            }
            unidadeId = logado.getUnidade().getId();
        }

        /*
         * Compatibilidade com bancos MySQL já criados antes da versão ADMIN_UNIDADE:
         * o administrador de unidade é salvo como ADMINISTRADOR com unidade_id preenchido.
         * Administrador geral continua sendo ADMINISTRADOR com unidade_id nulo.
         */
        if (tipoParaSalvar == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE) {
            tipoParaSalvar = br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR;
        }

        Unidade unidade = null;
        if (unidadeId != null) {
            unidade = unidadeRepository.findById(unidadeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Unidade não encontrada"));
        }

        Usuario usuario = Usuario.builder()
                .nome(dto.getNome() == null ? null : dto.getNome().trim())
                .email(email)
                .usuario(loginUsuario.isBlank() ? null : loginUsuario)
                .senha(passwordEncoder.encode(dto.getSenha()))
                .tipoUsuario(tipoParaSalvar)
                .ativo(true)
                .senhaTemporaria(true)
                .unidade(unidade)
                .build();

        usuarioRepository.save(usuario);
    }

    public void changePassword(ChangePasswordDTO dto, Authentication authentication) {
        if (authentication == null) {
            throw new ResourceNotFoundException("Sessão não encontrada");
        }
        Usuario usuario = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
        if (!passwordEncoder.matches(dto.getSenhaAtual(), usuario.getSenha())) {
            throw new BusinessRuleException("Senha atual inválida");
        }
        usuario.setSenha(passwordEncoder.encode(dto.getNovaSenha()));
        usuario.setSenhaTemporaria(false);
        usuarioRepository.save(usuario);
    }


    private void liberarCredenciaisDeUsuariosInativos(String email, String loginUsuario) {
        if (email != null && !email.isBlank()) {
            usuarioRepository.findByEmail(email).ifPresent(usuario -> {
                if (!Boolean.TRUE.equals(usuario.getAtivo())) {
                    anonimizarUsuarioInativo(usuario);
                }
            });
        }
        if (loginUsuario != null && !loginUsuario.isBlank()) {
            usuarioRepository.findByUsuario(loginUsuario).ifPresent(usuario -> {
                if (!Boolean.TRUE.equals(usuario.getAtivo())) {
                    anonimizarUsuarioInativo(usuario);
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

    private Usuario buscarPorIdentificador(String identificador) {
        String valor = identificador == null ? "" : identificador.trim();

        return usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(valor)
                .or(() -> usuarioRepository.findByUsuarioIgnoreCaseAndAtivoTrue(valor))
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }

    private boolean isAdminUnidade(Usuario usuario) {
        return usuario != null
                && (usuario.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE
                || (usuario.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && usuario.getUnidade() != null));
    }

    private boolean isAdministradorGeralSolicitado(br.com.sap.entity.enums.TipoUsuario tipo, Long unidadeId) {
        return tipo == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && unidadeId == null;
    }
}
