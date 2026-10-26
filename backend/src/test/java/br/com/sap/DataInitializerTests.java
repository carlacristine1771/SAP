package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Initial administrator: disabled unless explicitly enabled, no password in the source,
 * secure configuration required, temporary password on creation, existing accounts
 * never touched and no secret in the logs. All values are fictional.
 */
@ExtendWith(OutputCaptureExtension.class)
class DataInitializerTests {
    static final String EMAIL = "bootstrap@example.invalid";
    static final String USERNAME = "bootstrap-admin";
    static final String PASSWORD = "Fictional-Bootstrap-2026";

    final UsuarioRepository users = mock(UsuarioRepository.class);
    final PasswordEncoder encoder = new BCryptPasswordEncoder();

    DataInitializer initializer(boolean enabled, String email, String username, String password) {
        return new DataInitializer(users, encoder, enabled, email, username, "Administrador Teste", password);
    }

    Usuario saved() {
        ArgumentCaptor<Usuario> account = ArgumentCaptor.forClass(Usuario.class);
        verify(users).save(account.capture());
        return account.getValue();
    }

    // ----- disabled by default ------------------------------------------------

    @Test
    void withoutAnyPropertyTheInitializerIsDisabled() {
        new ApplicationContextRunner()
            .withBean(UsuarioRepository.class, () -> users)
            .withBean(PasswordEncoder.class, () -> encoder)
            .withBean(DataInitializer.class)
            .run(context -> {
                context.getBean(DataInitializer.class).run();
                verifyNoInteractions(users);
            });
    }

    @Test
    void credentialsAloneDoNotEnableIt() {
        new ApplicationContextRunner()
            .withBean(UsuarioRepository.class, () -> users)
            .withBean(PasswordEncoder.class, () -> encoder)
            .withBean(DataInitializer.class)
            .withPropertyValues("sap.bootstrap-admin.email=" + EMAIL, "sap.bootstrap-admin.usuario=" + USERNAME,
                "sap.bootstrap-admin.senha=" + PASSWORD)
            .run(context -> {
                context.getBean(DataInitializer.class).run();
                verifyNoInteractions(users);
            });
    }

    @Test
    void noApplicationProfileEnablesItOrDefinesAPassword() throws IOException {
        try (Stream<Path> files = Files.list(Path.of("src/main/resources"))) {
            for (Path file : files.filter(f -> f.getFileName().toString().endsWith(".properties")).toList()) {
                List<String> lines = Files.readAllLines(file);
                assertThat(lines).as(file.toString())
                    .noneMatch(line -> line.replace(" ", "").startsWith("sap.bootstrap-admin.enabled=true"))
                    .noneMatch(line -> line.replace(" ", "").startsWith("sap.bootstrap-admin.enabled=${SAP_BOOTSTRAP_ADMIN_ENABLED:true}"))
                    .noneMatch(line -> line.trim().startsWith("sap.bootstrap-admin.senha"));
            }
        }
    }

    // ----- no fixed password ----------------------------------------------------

    @Test
    void theSourceHasNoLiteralPassword() throws IOException {
        String source = Files.readString(Path.of("src/main/java/br/com/sap/config/DataInitializer.java"));
        assertThat(source).doesNotContainPattern("encode\\(\\s*\"");
        assertThat(source).doesNotContainPattern("senha:[^}]+}");
    }

    @Test
    void enabledWithoutAPasswordRefusesToStartAndCreatesNothing() {
        assertThatThrownBy(() -> initializer(true, EMAIL, USERNAME, "").run())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SAP_BOOTSTRAP_ADMIN_SENHA");
        verifyNoInteractions(users);
    }

    @Test
    void enabledWithAShortOrTrivialPasswordRefusesToStart() {
        assertThatThrownBy(() -> initializer(true, EMAIL, USERNAME, "short-pass").run())
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> initializer(true, EMAIL, "same-as-password-1", "same-as-password-1").run())
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> initializer(true, EMAIL, USERNAME, "            ").run())
            .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(users);
    }

    @Test
    void enabledWithoutEmailOrUsernameRefusesToStart() {
        assertThatThrownBy(() -> initializer(true, "", USERNAME, PASSWORD).run())
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("SAP_BOOTSTRAP_ADMIN_EMAIL");
        assertThatThrownBy(() -> initializer(true, "not-an-email", USERNAME, PASSWORD).run())
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("SAP_BOOTSTRAP_ADMIN_EMAIL");
        assertThatThrownBy(() -> initializer(true, EMAIL, " ", PASSWORD).run())
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("SAP_BOOTSTRAP_ADMIN_USUARIO");
        verifyNoInteractions(users);
    }

    // ----- creation with a mandatory password change ------------------------------

    @Test
    void theInitialAccountIsAGlobalAdministratorWithATemporaryPassword() {
        initializer(true, EMAIL, USERNAME, PASSWORD).run();

        Usuario account = saved();
        assertThat(account.getEmail()).isEqualTo(EMAIL);
        assertThat(account.getUsuario()).isEqualTo(USERNAME);
        assertThat(account.getTipoUsuario()).isEqualTo(TipoUsuario.ADMINISTRADOR);
        assertThat(account.getUnidade()).isNull();
        assertThat(account.getAtivo()).isTrue();
        assertThat(account.getSenhaTemporaria()).as("password change required on first access").isTrue();
        assertThat(account.getSenha()).isNotEqualTo(PASSWORD).startsWith("$2");
        assertThat(encoder.matches(PASSWORD, account.getSenha())).isTrue();
    }

    @Test
    void theConfiguredValuesAreReadFromTheEnvironmentProperties() {
        new ApplicationContextRunner()
            .withBean(UsuarioRepository.class, () -> users)
            .withBean(PasswordEncoder.class, () -> encoder)
            .withBean(DataInitializer.class)
            .withPropertyValues("sap.bootstrap-admin.enabled=true", "sap.bootstrap-admin.email=" + EMAIL,
                "sap.bootstrap-admin.usuario=" + USERNAME, "sap.bootstrap-admin.senha=" + PASSWORD)
            .run(context -> context.getBean(DataInitializer.class).run());

        Usuario account = saved();
        assertThat(account.getSenhaTemporaria()).isTrue();
        assertThat(encoder.matches(PASSWORD, account.getSenha())).isTrue();
    }

    // ----- existing accounts are preserved ------------------------------------------

    @Test
    void anExistingAccountWithTheSameEmailIsNeverChanged() {
        doReturn(true).when(users).existsByEmailIgnoreCase(EMAIL);

        initializer(true, EMAIL, USERNAME, PASSWORD).run();

        verify(users, never()).save(any());
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void anExistingAccountWithTheSameUsernameIsNeverChanged() {
        doReturn(true).when(users).existsByUsuarioIgnoreCase(USERNAME);

        initializer(true, EMAIL, USERNAME, PASSWORD).run();

        verify(users, never()).save(any());
        verify(users, never()).saveAndFlush(any());
    }

    // ----- logs -----------------------------------------------------------------------

    @Test
    void theLogsNeverContainThePasswordOrTheEmail(CapturedOutput output) {
        initializer(true, EMAIL, USERNAME, PASSWORD).run();
        doReturn(true).when(users).existsByEmailIgnoreCase(EMAIL);
        initializer(true, EMAIL, USERNAME, PASSWORD).run();
        try {
            initializer(true, EMAIL, USERNAME, "short-pass").run();
        } catch (IllegalStateException expected) {
            assertThat(expected.getMessage()).doesNotContain("short-pass").doesNotContain(EMAIL);
        }

        assertThat(output.getAll()).contains("Administrador inicial criado")
            .doesNotContain(PASSWORD).doesNotContain(EMAIL);
    }
}
