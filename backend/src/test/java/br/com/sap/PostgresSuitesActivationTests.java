package br.com.sap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every suite that runs create-drop against PostgreSQL needs explicit activation and
 * DisposablePostgresGuard, and the runner activates exactly that suite and treats
 * skipped tests as a failure. Reads only annotations and the runner's text.
 */
class PostgresSuitesActivationTests {
    static final Map<Class<?>, String> SUITES = Map.of(
        PostgresUnitNameUniquenessTests.class, "SAP_UNIT_NAME_POSTGRES",
        PostgresFirstAccessAuthenticationTests.class, "SAP_AUTH_POSTGRES");

    @Test
    void eachPostgresSuiteRequiresItsOwnActivationVariable() {
        SUITES.forEach((suite, variable) -> {
            EnabledIfEnvironmentVariable activation = suite.getAnnotation(EnabledIfEnvironmentVariable.class);
            assertThat(activation).as(suite.getSimpleName()).isNotNull();
            assertThat(activation.named()).isEqualTo(variable);
            assertThat(activation.matches()).isEqualTo("true");
        });
    }

    @Test
    void eachPostgresSuiteImportsTheGuardThatRunsBeforeAnyDdl() {
        SUITES.keySet().forEach(suite -> {
            assertThat(suite.getAnnotation(Import.class)).as(suite.getSimpleName()).isNotNull();
            assertThat(suite.getAnnotation(Import.class).value()).contains(DisposablePostgresGuard.class);
            assertThat(String.join(",", suite.getAnnotation(SpringBootTest.class).properties()))
                .contains("spring.config.location=classpath:/application-auth-postgres.properties");
        });
    }

    @Test
    void theActivationVariablesAreNotSetInThisLocalRun() {
        SUITES.values().forEach(variable -> assertThat(System.getenv(variable)).as(variable).isNull());
    }

    @Test
    void theRunnerActivatesOnlyTheChosenSuiteAndFailsOnSkippedTests() throws IOException {
        String runner = Files.readString(Path.of("..", "run-unit-name-postgres.ps1"));

        assertThat(runner).contains("[ValidateSet('unit-name', 'first-access')]");
        SUITES.forEach((suite, variable) -> assertThat(runner)
            .contains("Class = '" + suite.getName() + "'; Activation = '" + variable + "'"));
        assertThat(runner).contains("$start.EnvironmentVariables.Clear()")
            .contains("$start.EnvironmentVariables[$activation] = 'true'")
            .contains("if ($skipped -ne 0) { throw")
            .contains("if ($total -eq 0) { throw");
    }
}
