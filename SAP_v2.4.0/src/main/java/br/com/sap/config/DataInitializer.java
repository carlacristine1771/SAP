package br.com.sap.config;

import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        criarAdminPrincipalSeNaoExistir();
    }

    private void criarAdminPrincipalSeNaoExistir() {
        String email = "carla58380986@sap.com";
        String usuario = "carla58380986";

        if (usuarioRepository.existsByEmail(email) || usuarioRepository.existsByUsuario(usuario)) {
            return;
        }

        usuarioRepository.save(Usuario.builder()
                .nome("Carla Cristine da Silva")
                .email(email)
                .usuario(usuario)
                .senha(passwordEncoder.encode("CarAli1724"))
                .tipoUsuario(TipoUsuario.ADMINISTRADOR)
                .ativo(true)
                .senhaTemporaria(false)
                .unidade(null)
                .build());
    }
}
