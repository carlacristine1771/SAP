package br.com.sap;

import br.com.sap.exception.BusinessRuleException;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.service.UnidadeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.BatchUpdateException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

/**
 * Same cases against a disposable PostgreSQL (fictional credentials on 127.0.0.1),
 * plus the PostgreSQL-only ones: partial unique indexes, a constraint with the same
 * name in another schema and errors reported only through getNextException().
 * Runs only when SAP_UNIT_NAME_POSTGRES=true. DisposablePostgresGuard checks the
 * effective connection when the DataSource is created, before Hibernate's create-drop,
 * and refuses any database that is not a fresh, empty, unshared local PostgreSQL.
 */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-postgres.properties",
    "server.port=0"
})
@Import(DisposablePostgresGuard.class)
@EnabledIfEnvironmentVariable(named = "SAP_UNIT_NAME_POSTGRES", matches = "true")
class PostgresUnitNameUniquenessTests extends UnitNameUniquenessTests {

    @Override
    void checkDatabase() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("auth_disposable");
        assertThat(jdbc.queryForObject("select current_schema", String.class)).isEqualTo("public");
    }

    @Test
    void theProductionConstraintNameIsRecognized() {
        // backend/docs/supabase-schema.sql declares "nome ... unique", which PostgreSQL
        // names unidades_nome_key; the schema generated for the tests gets the same name.
        assertThat(nameConstraint()).isEqualTo("unidades_nome_key");
        persisted("Unidade Produção", "Endereço 1", "(61) 0000-0001");

        assertThatThrownBy(() -> racingService().criar(body("Unidade Produção", "Endereço 2", "(61) 0000-0002"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
    }

    @Test
    void aPartialUniqueIndexOnTheNameIsNotTreatedAsTheConstraint() {
        String constraint = "\"" + nameConstraint() + "\"";
        jdbc.execute("alter table unidades drop constraint " + constraint);
        jdbc.execute("create unique index ux_unidades_nome_parcial_teste on unidades (nome) where endereco = 'Parcial'");
        try {
            persisted("Unidade Parcial", "Parcial", "(61) 0000-0001");
            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade Parcial", "Parcial", "(61) 0000-0002"), null));
        } finally {
            jdbc.execute("drop index ux_unidades_nome_parcial_teste");
            jdbc.execute("alter table unidades add constraint " + constraint + " unique (nome)");
        }
    }

    @Test
    void theSameConstraintNameOnUnidadesInAnotherSchemaKeepsTheOriginalException() {
        // A trigger copies each new unit into outro.unidades, whose UNIQUE(nome) has the
        // very same constraint name: only the schema tells them apart.
        String constraint = "\"" + nameConstraint() + "\"";
        jdbc.execute("create schema outro_teste");
        try {
            jdbc.execute("create table outro_teste.unidades (nome varchar(255) not null constraint " + constraint + " unique)");
            jdbc.execute("""
                create function outro_teste.copiar_unidade() returns trigger language plpgsql as $$
                begin
                    insert into outro_teste.unidades (nome) values (new.nome);
                    return new;
                end
                $$""");
            jdbc.execute("create trigger copiar_unidade_teste after insert on public.unidades "
                + "for each row execute function outro_teste.copiar_unidade()");
            jdbc.update("insert into outro_teste.unidades (nome) values ('Unidade Espelhada')");

            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade Espelhada", "Endereço 1", "(61) 0000-0001"), null));
            assertThat(units.count()).isZero();
        } finally {
            jdbc.execute("drop trigger if exists copiar_unidade_teste on public.unidades");
            jdbc.execute("drop schema outro_teste cascade");
        }
    }

    // ----- search_path ------------------------------------------------------

    /** Pooled connection with a session search_path, reset before it returns to the pool. */
    static Connection withSearchPath(Connection connection, String searchPath) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("set search_path to " + searchPath);
        }
        return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[] {Connection.class},
            (proxy, method, arguments) -> {
                if (method.getName().equals("close")) {
                    try (Statement statement = connection.createStatement()) {
                        statement.execute("reset search_path");
                    }
                }
                try {
                    return method.invoke(connection, arguments);
                } catch (InvocationTargetException failure) {
                    throw failure.getCause();
                }
            });
    }

    @Test
    void aCatalogReadThroughAnotherSearchPathKeepsTheOriginalException() throws SQLException {
        // The catalog connection resolves "unidades" to sombra_teste.unidades, whose UNIQUE(nome)
        // has the very same constraint name, while the write still goes to public.unidades.
        String constraint = "\"" + nameConstraint() + "\"";
        jdbc.execute("create schema sombra_teste");
        try {
            jdbc.execute("create table sombra_teste.unidades (nome varchar(255) not null constraint " + constraint + " unique)");
            DataSource shifted = mock(DataSource.class);
            doAnswer(invocation -> withSearchPath(dataSource.getConnection(), "sombra_teste, public"))
                .when(shifted).getConnection();
            persisted("Unidade Sombra", "Endereço 1", "(61) 0000-0001");

            assertOriginalPreserved(() -> new UnidadeService(racingRepository(), globalAdmin, validator, shifted)
                .criar(body("Unidade Sombra", "Endereço 2", "(61) 0000-0002"), null));
            assertThatThrownBy(() -> racingService().criar(body("Unidade Sombra", "Endereço 3", "(61) 0000-0003"), null))
                .as("the application's own search_path still recognizes the constraint")
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage(DUPLICATE_MESSAGE);
            assertThat(jdbc.queryForObject("show search_path", String.class)).doesNotContain("sombra_teste");
        } finally {
            jdbc.execute("drop schema sombra_teste cascade");
        }
    }

    // ----- details only in getNextException() (JDBC batch) -----------------

    /** Real PgJDBC batch failure: the BatchUpdateException carries no server details. */
    BatchUpdateException batchFailure(String first, String second, boolean sameName) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement insert = connection.prepareStatement(
                 "insert into unidades (nome, endereco, telefone, created_at) values (?, ?, ?, ?)")) {
            connection.setAutoCommit(false);
            try {
                for (String nome : new String[] {first, second}) {
                    insert.setString(1, nome);
                    insert.setString(2, "Endereço " + nome);
                    insert.setString(3, sameName ? "(61) " + nome : "(61) 0000-0000");
                    insert.setTimestamp(4, Timestamp.valueOf(LocalDateTime.now()));
                    insert.addBatch();
                }
                insert.executeBatch();
                return fail("batch should violate a unique rule");
            } catch (BatchUpdateException expected) {
                return expected;
            } finally {
                connection.rollback();
                connection.setAutoCommit(true);
            }
        }
    }

    UnidadeRepository failingWith(BatchUpdateException failure) {
        UnidadeRepository failing = mock(UnidadeRepository.class);
        doReturn(false).when(failing).existsByNome(any());
        doThrow(new DataIntegrityViolationException("batch", failure)).when(failing).saveAndFlush(any());
        return failing;
    }

    @Test
    void theNameConstraintReportedOnlyInTheNextExceptionIsRecognized() throws SQLException {
        BatchUpdateException failure = batchFailure("Unidade Lote", "Unidade Lote", true);
        assertThat((Throwable) failure.getNextException()).as("server details in the chained exception")
            .isNotNull().extracting(next -> next.getClass().getSimpleName()).isEqualTo("PSQLException");

        assertThatThrownBy(() -> service(failingWith(failure)).criar(body("Unidade Lote", "Endereço", "Telefone"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
    }

    /** Real server error raised by the last of the given statements, rolled back. */
    SQLException realViolation(String... statements) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            try {
                for (String sql : statements) {
                    statement.execute(sql);
                }
                return fail("the statements should violate a rule");
            } catch (SQLException expected) {
                return expected;
            } finally {
                connection.rollback();
                connection.setAutoCommit(true);
            }
        }
    }

    @Test
    void theDriverReportsTheSameExceptionAsCauseAndNextOfTheBatch() throws SQLException {
        BatchUpdateException failure = batchFailure("Unidade Compartilhada", "Unidade Compartilhada", true);
        assertThat(failure.getCause()).as("shared node").isSameAs(failure.getNextException());

        assertThatThrownBy(() -> service(failingWith(failure)).criar(body("Unidade Compartilhada", "Endereço", "Telefone"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
    }

    @Test
    void aRealNameViolationFollowedByARealViolationOfAnotherUniqueConstraintKeepsTheSameException() throws SQLException {
        jdbc.execute("alter table unidades add constraint uk_unidades_telefone_teste unique (telefone)");
        try {
            SQLException other = realViolation(
                "insert into unidades (nome, endereco, telefone, created_at) values ('Unidade A', 'E', '(61) 9', now())",
                "insert into unidades (nome, endereco, telefone, created_at) values ('Unidade B', 'E', '(61) 9', now())");
            assertThat(other.getSQLState()).isEqualTo("23505");
            BatchUpdateException batch = batchFailure("Unidade Lote Misto", "Unidade Lote Misto", true);
            batch.setNextException(other);
            DataIntegrityViolationException failure = new DataIntegrityViolationException("batch", batch);

            assertThatThrownBy(() -> service(throwing(failure)).criar(body("Unidade Lote Misto", "Endereço", "Telefone"), null))
                .isSameAs(failure);
        } finally {
            jdbc.execute("alter table unidades drop constraint uk_unidades_telefone_teste");
        }
    }

    @Test
    void aRealNameViolationFollowedByARealNotNullViolationKeepsTheSameException() throws SQLException {
        SQLException notNull = realViolation(
            "insert into unidades (nome, endereco, telefone, created_at) values (null, 'E', '(61) 9', now())");
        assertThat(notNull.getSQLState()).isEqualTo("23502");
        BatchUpdateException batch = batchFailure("Unidade Nula", "Unidade Nula", true);
        batch.setNextException(notNull);
        DataIntegrityViolationException failure = new DataIntegrityViolationException("batch", batch);

        assertThatThrownBy(() -> service(throwing(failure)).criar(body("Unidade Nula", "Endereço", "Telefone"), null))
            .isSameAs(failure);
    }

    @Test
    void anotherConstraintReportedOnlyInTheNextExceptionKeepsTheOriginal() throws SQLException {
        jdbc.execute("alter table unidades add constraint uk_unidades_telefone_teste unique (telefone)");
        try {
            BatchUpdateException failure = batchFailure("Unidade Lote 1", "Unidade Lote 2", false);
            assertThat((Throwable) failure.getNextException()).as("server details in the chained exception")
            .isNotNull().extracting(next -> next.getClass().getSimpleName()).isEqualTo("PSQLException");

            assertOriginalPreserved(() ->
                service(failingWith(failure)).criar(body("Unidade Lote 3", "Endereço", "Telefone"), null));
        } finally {
            jdbc.execute("alter table unidades drop constraint uk_unidades_telefone_teste");
        }
    }
}
