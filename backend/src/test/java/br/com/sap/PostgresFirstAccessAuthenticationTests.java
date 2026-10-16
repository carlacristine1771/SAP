package br.com.sap;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;

/** Same regression cases against PostgreSQL, plus real HTTP/browser integration. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT, properties = {
    "spring.config.location=classpath:/application-auth-postgres.properties"
})
class PostgresFirstAccessAuthenticationTests extends FirstAccessAuthenticationTests {
    @Autowired JdbcTemplate jdbc;

    @Test
    void realBrowserRegistrationFirstAccessAndPersistedPassword() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("auth_disposable");
        String admin = jwt.generateToken(existing);
        Path frontend = Path.of("..", "frontend").toAbsolutePath().normalize();
        ProcessBuilder builder = new ProcessBuilder("cmd.exe", "/d", "/c",
            "node_modules\\.bin\\playwright.cmd test --config playwright.postgres.config.ts");
        builder.directory(frontend.toFile()).inheritIO();
        // Never pass inherited application, proxy, Node or database settings.
        var inherited = new java.util.HashMap<>(builder.environment());
        builder.environment().clear();
        for (String name : new String[]{"SystemRoot", "WINDIR", "ComSpec", "PATH", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"}) {
            inherited.forEach((key, value) -> { if (key.equalsIgnoreCase(name)) builder.environment().put(key, value); });
        }
        builder.environment().put("AUTH_FICTIONAL_ADMIN_TOKEN", admin);
        Process browser = builder.start();
        try {
            assertThat(browser.waitFor(180, TimeUnit.SECONDS)).as("browser completed").isTrue();
            assertThat(browser.exitValue()).as("real browser tests").isZero();
        } finally {
            if (browser.isAlive()) {
                browser.descendants().forEach(ProcessHandle::destroyForcibly);
                browser.destroyForcibly();
            }
        }
        // Independent SQL read after the HTTP transactions and new login.
        for (String project : new String[]{"desktop", "mobile"}) {
            String email = "pg-" + project + "@example.invalid";
            var row = jdbc.queryForMap("select senha, senha_temporaria from usuarios where email = ?", email);
            assertThat(row.get("senha_temporaria")).isEqualTo(false);
            String hash = (String) row.get("senha");
            assertThat(hash).startsWith("$2");
            assertThat(encoder.matches("new-password-postgres", hash)).isTrue();
            assertThat(encoder.matches("temporary-test", hash)).isFalse();
        }
    }
}
