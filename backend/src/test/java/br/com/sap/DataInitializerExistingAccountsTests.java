package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Initial administrator against a real repository (H2): an existing account with the
 * same e-mail or username, in any letter case and even when inactive, is never
 * changed and no second account is created. All values are fictional.
 */
@DataJpaTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:bootstrap_existing_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class DataInitializerExistingAccountsTests {
    static final String EMAIL = "bootstrap@example.invalid";
    static final String USERNAME = "bootstrap-admin";
    static final String PASSWORD = "Fictional-Bootstrap-2026";
    static final String EXISTING_PASSWORD = "Fictional-Existing-2026";

    final PasswordEncoder encoder = new BCryptPasswordEncoder();
    @Autowired UsuarioRepository users;

    @BeforeEach
    void empty() {
        users.deleteAll();
    }

    DataInitializer initializer() {
        return new DataInitializer(users, encoder, true, EMAIL, USERNAME, "Administrador Teste", PASSWORD);
    }

    Usuario existing(String email, String username, boolean active) {
        return users.saveAndFlush(Usuario.builder().nome("Fictional Existing").email(email).usuario(username)
            .senha(encoder.encode(EXISTING_PASSWORD)).tipoUsuario(TipoUsuario.INSTRUTOR)
            .ativo(active).senhaTemporaria(false).build());
    }

    void assertUnchanged(Usuario before) {
        List<Usuario> all = users.findAll();
        assertThat(all).hasSize(1);
        Usuario after = all.get(0);
        assertThat(after.getId()).isEqualTo(before.getId());
        assertThat(after.getEmail()).isEqualTo(before.getEmail());
        assertThat(after.getUsuario()).isEqualTo(before.getUsuario());
        assertThat(after.getSenha()).isEqualTo(before.getSenha());
        assertThat(after.getTipoUsuario()).isEqualTo(before.getTipoUsuario());
        assertThat(after.getAtivo()).isEqualTo(before.getAtivo());
        assertThat(after.getSenhaTemporaria()).isEqualTo(before.getSenhaTemporaria());
        assertThat(encoder.matches(PASSWORD, after.getSenha())).isFalse();
    }

    @Test
    void anActiveAccountWithTheSameEmailInAnotherCaseIsNeverChanged() {
        Usuario before = existing("BootStrap@Example.INVALID", "someone-else", true);

        initializer().run();

        assertUnchanged(before);
    }

    @Test
    void anInactiveAccountWithTheSameEmailInAnotherCaseIsNeverChanged() {
        Usuario before = existing("BOOTSTRAP@EXAMPLE.INVALID", "someone-else", false);

        initializer().run();

        assertUnchanged(before);
    }

    @Test
    void anActiveAccountWithTheSameUsernameInAnotherCaseIsNeverChanged() {
        Usuario before = existing("someone-else@example.invalid", "Bootstrap-Admin", true);

        initializer().run();

        assertUnchanged(before);
    }

    @Test
    void anInactiveAccountWithTheSameUsernameInAnotherCaseIsNeverChanged() {
        Usuario before = existing("someone-else@example.invalid", "BOOTSTRAP-ADMIN", false);

        initializer().run();

        assertUnchanged(before);
    }

    @Test
    void withoutAMatchingAccountTheAdministratorIsCreatedWithATemporaryPassword() {
        existing("someone-else@example.invalid", "someone-else", false);

        initializer().run();

        Usuario created = users.findAll().stream().filter(u -> EMAIL.equals(u.getEmail())).findFirst().orElseThrow();
        assertThat(users.count()).isEqualTo(2);
        assertThat(created.getUsuario()).isEqualTo(USERNAME);
        assertThat(created.getTipoUsuario()).isEqualTo(TipoUsuario.ADMINISTRADOR);
        assertThat(created.getSenhaTemporaria()).as("password change required on first access").isTrue();
        assertThat(encoder.matches(PASSWORD, created.getSenha())).isTrue();
    }
}
