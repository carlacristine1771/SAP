package br.com.sap;

import br.com.sap.DisposablePostgresGuard.Fingerprint;
import br.com.sap.entity.Unidade;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * DisposablePostgresGuard, without Docker: refusal rules over server fingerprints, and a
 * real Spring context on H2 proving the refusal happens before Hibernate's DDL.
 */
class DisposablePostgresGuardTests {
    static final String LOCAL = "jdbc:postgresql://127.0.0.1:55486/auth_disposable?sslmode=disable";

    /** What a new postgres:16 container with POSTGRES_DB/POSTGRES_USER reports. */
    static Fingerprint fresh() {
        return new Fingerprint("PostgreSQL", LOCAL, "auth_disposable", "auth_fictional", "auth_fictional",
            "plpgsql", "auth_disposable,postgres", "public", 0);
    }

    static Fingerprint with(String url, String database, String roles, String extensions,
                            String databases, String schemas, long relations) {
        return new Fingerprint("PostgreSQL", url, database, "auth_fictional", roles, extensions, databases, schemas, relations);
    }

    @Test
    void aFreshLocalDisposableDatabaseIsAccepted() {
        assertThat(DisposablePostgresGuard.problems(fresh())).isEmpty();
    }

    @Test
    void aSupabaseLikeServerIsRefusedEvenWithTheExpectedNameAndALoopbackTunnel() {
        Fingerprint supabase = with(LOCAL, "auth_disposable",
            "anon,auth_fictional,authenticated,authenticator,service_role,supabase_admin",
            "pg_graphql,pg_stat_statements,pgcrypto,plpgsql,supabase_vault,uuid-ossp",
            "auth_disposable,postgres", "auth,extensions,graphql,public,storage,vault", 120);
        assertThat(DisposablePostgresGuard.problems(supabase)).hasSize(4);
    }

    @Test
    void aNonEmptyDatabaseIsRefused() {
        assertThat(DisposablePostgresGuard.problems(with(LOCAL, "auth_disposable", "auth_fictional", "plpgsql",
            "auth_disposable,postgres", "public", 3))).singleElement().asString().contains("not empty");
    }

    @Test
    void otherSchemasRolesExtensionsOrDatabasesAreRefused() {
        assertThat(DisposablePostgresGuard.problems(with(LOCAL, "auth_disposable", "auth_fictional", "plpgsql",
            "auth_disposable,postgres", "app,public", 0))).hasSize(1);
        assertThat(DisposablePostgresGuard.problems(with(LOCAL, "auth_disposable", "auth_fictional,postgres", "plpgsql",
            "auth_disposable,postgres", "public", 0))).hasSize(1);
        assertThat(DisposablePostgresGuard.problems(with(LOCAL, "auth_disposable", "auth_fictional", "pgcrypto,plpgsql",
            "auth_disposable,postgres", "public", 0))).hasSize(1);
        assertThat(DisposablePostgresGuard.problems(with(LOCAL, "auth_disposable", "auth_fictional", "plpgsql",
            "auth_disposable,postgres,sap", "public", 0))).hasSize(1);
    }

    @Test
    void anotherDatabaseNameIsRefused() {
        assertThat(DisposablePostgresGuard.problems(with(LOCAL.replace("auth_disposable", "postgres"), "postgres",
            "auth_fictional", "plpgsql", "postgres", "public", 0))).singleElement().asString().contains("unexpected database");
    }

    @Test
    void onlyASingleLoopbackIpAddressIsAccepted() {
        assertThat(DisposablePostgresGuard.loopback(LOCAL)).isTrue();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://127.0.0.2/auth_disposable")).isTrue();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://[::1]:55486/auth_disposable")).isTrue();

        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://localhost:55486/auth_disposable"))
            .as("host names are not resolved").isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://db.example.supabase.co:5432/postgres")).isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://10.0.0.5:5432/auth_disposable")).isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://127.0.0.1:55486,10.0.0.5:5432/auth_disposable"))
            .as("multiple hosts").isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://127.0.0.1.example.com/auth_disposable")).isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql://127.0.0.999/auth_disposable")).isFalse();
        assertThat(DisposablePostgresGuard.loopback("jdbc:postgresql:auth_disposable")).isFalse();
        assertThat(DisposablePostgresGuard.loopback(null)).isFalse();
        assertThat(DisposablePostgresGuard.problems(with("jdbc:postgresql://10.0.0.5:5432/auth_disposable",
            "auth_disposable", "auth_fictional", "plpgsql", "auth_disposable,postgres", "public", 0))).hasSize(1);
    }

    @Test
    void anotherProductIsRefusedWithoutQueryingIt() throws SQLException {
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        doReturn(metadata).when(connection).getMetaData();
        doReturn("H2").when(metadata).getDatabaseProductName();

        Fingerprint h2 = DisposablePostgresGuard.read(connection);

        assertThat(DisposablePostgresGuard.problems(h2)).containsExactly("not PostgreSQL: H2");
    }

    @Test
    void anUnverifiableDataSourceIsRefusedAndOtherBeansPassThrough() throws SQLException {
        DataSource unreachable = mock(DataSource.class);
        doThrow(new SQLException("Connection refused", "08001")).when(unreachable).getConnection();
        Object other = new Object();
        DisposablePostgresGuard guard = new DisposablePostgresGuard();

        assertThat(guard.postProcessAfterInitialization(other, "other")).isSameAs(other);
        assertThatThrownBy(() -> guard.postProcessAfterInitialization(unreachable, "dataSource"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("could not be verified");
    }

    @Test
    void anotherProductIsRefusedWithoutRunningAnyStatement() throws SQLException {
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        DataSource dataSource = mock(DataSource.class);
        doReturn(connection).when(dataSource).getConnection();
        doReturn(metadata).when(connection).getMetaData();
        doReturn("H2").when(metadata).getDatabaseProductName();

        assertThatThrownBy(() -> new DisposablePostgresGuard().postProcessAfterInitialization(dataSource, "dataSource"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Refusing database");
        verify(connection, never()).createStatement();
        verify(connection, never()).prepareStatement(any());
    }

    // ----- ordering against Hibernate's schema generation --------------------

    @Configuration(proxyBeanMethods = false)
    @EntityScan(basePackageClasses = Unidade.class)
    static class Entities {
    }

    static ApplicationContextRunner jpaOn(String url) {
        return new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                HibernateJpaAutoConfiguration.class, TransactionAutoConfiguration.class))
            .withUserConfiguration(Entities.class)
            .withPropertyValues("spring.datasource.url=" + url, "spring.datasource.username=sa",
                "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create",
                "spring.sql.init.mode=never");
    }

    static long tables(String url) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement();
             ResultSet count = statement.executeQuery(
                 "select count(*) from information_schema.tables where table_schema = 'public'")) {
            count.next();
            return count.getLong(1);
        }
    }

    static void drop(String url) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("shutdown");
        }
    }

    static String probeUrl() {
        return "jdbc:h2:mem:guard_probe_" + UUID.randomUUID().toString().replace("-", "")
            + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE";
    }

    @Test
    void withoutTheGuardHibernateCreatesTheSchema() throws SQLException {
        String url = probeUrl();
        try {
            jpaOn(url).run(context -> assertThat(context).hasNotFailed());
            assertThat(tables(url)).as("control: the probe detects DDL").isPositive();
        } finally {
            drop(url);
        }
    }

    @Test
    void theGuardRefusesTheDataSourceBeforeHibernateRunsAnyDdl() throws SQLException {
        String url = probeUrl();
        try {
            jpaOn(url).withUserConfiguration(DisposablePostgresGuard.class).run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("Refusing database");
            });
            assertThat(tables(url)).as("no table created").isZero();
        } finally {
            drop(url);
        }
    }
}
