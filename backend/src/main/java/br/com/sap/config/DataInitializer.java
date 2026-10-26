package br.com.sap.config;

import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/*
 * Criação opcional do administrador geral inicial (ADMINISTRADOR sem unidade).
 *
 * Desabilitada por padrão, em todos os perfis: só roda com
 * SAP_BOOTSTRAP_ADMIN_ENABLED=true. Habilitada, exige e-mail, usuário e senha
 * vindos do ambiente (SAP_BOOTSTRAP_ADMIN_EMAIL, _USUARIO, _SENHA); não há senha
 * padrão e configuração incompleta ou fraca impede a inicialização. A conta é
 * criada com senha temporária, então a troca é obrigatória no primeiro acesso.
 * Conta existente (mesmo e-mail ou mesmo usuário, sem distinguir maiúsculas de
 * minúsculas e incluindo contas inativas) nunca é alterada. Os logs não
 * trazem a senha nem o e-mail.
 */
@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    static final int TAMANHO_MINIMO_SENHA = 12;

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean habilitado;
    private final String email;
    private final String usuario;
    private final String nome;
    private final String senha;

    public DataInitializer(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            @Value("${sap.bootstrap-admin.enabled:false}") boolean habilitado,
            @Value("${sap.bootstrap-admin.email:}") String email,
            @Value("${sap.bootstrap-admin.usuario:}") String usuario,
            @Value("${sap.bootstrap-admin.nome:Administrador SAP}") String nome,
            @Value("${sap.bootstrap-admin.senha:}") String senha
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.habilitado = habilitado;
        this.email = email == null ? "" : email.trim();
        this.usuario = usuario == null ? "" : usuario.trim();
        this.nome = nome == null || nome.isBlank() ? "Administrador SAP" : nome.trim();
        this.senha = senha == null ? "" : senha;
    }

    @Override
    public void run(String... args) {

        if (!habilitado) {
            log.info("Criação do administrador inicial desabilitada (sap.bootstrap-admin.enabled=false).");
            return;
        }
        validarConfiguracao();

        if (usuarioRepository.existsByEmailIgnoreCase(email) || usuarioRepository.existsByUsuarioIgnoreCase(usuario)) {
            log.info("Administrador inicial não criado: já existe conta com o e-mail ou o usuário configurado; nada foi alterado.");
            return;
        }

        usuarioRepository.save(Usuario.builder()
                .nome(nome)
                .email(email)
                .usuario(usuario)
                .senha(passwordEncoder.encode(senha))
                .tipoUsuario(TipoUsuario.ADMINISTRADOR)
                .ativo(true)
                .senhaTemporaria(true)
                .unidade(null)
                .build());
        log.info("Administrador inicial criado com senha temporária (usuario={}); a troca é obrigatória no primeiro acesso.", usuario);
    }

    /*
     * Falha a inicialização em vez de criar uma conta com dados incompletos ou senha
     * fraca. As mensagens citam apenas os nomes das variáveis, nunca os valores.
     */
    private void validarConfiguracao() {

        if (email.isEmpty() || !email.contains("@")) {
            throw new IllegalStateException("SAP_BOOTSTRAP_ADMIN_EMAIL ausente ou inválido.");
        }
        if (usuario.isEmpty()) {
            throw new IllegalStateException("SAP_BOOTSTRAP_ADMIN_USUARIO ausente.");
        }
        if (senha.isBlank() || senha.length() < TAMANHO_MINIMO_SENHA) {
            throw new IllegalStateException(
                    "SAP_BOOTSTRAP_ADMIN_SENHA ausente ou com menos de " + TAMANHO_MINIMO_SENHA + " caracteres.");
        }
        if (senha.equalsIgnoreCase(usuario) || senha.equalsIgnoreCase(email)) {
            throw new IllegalStateException("SAP_BOOTSTRAP_ADMIN_SENHA não pode ser igual ao usuário ou ao e-mail.");
        }
    }
}
