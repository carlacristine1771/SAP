package br.com.sap;

import br.com.sap.dto.unidade.UnidadeRequestDTO;
import br.com.sap.entity.Usuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.security.UsuarioPermissions;
import br.com.sap.service.UnidadeService;
import jakarta.validation.Validator;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import javax.sql.DataSource;
import java.sql.BatchUpdateException;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Classification of synthetic exception graphs, without a database: the catalog is a
 * mock reporting the UNIQUE constraint on unidades(nome) and the save fails with the
 * given exception. Covers mixed chains, exceptions without details, nested causes,
 * shared nodes and cycles; whenever the name constraint is not identified
 * unambiguously, the very same exception thrown by the repository must reach the caller.
 *
 * PostgreSQL exceptions are real PSQLException instances built by reflection (the
 * driver is a runtime-only dependency), with the server fields the driver would parse.
 */
class UnitNameViolationClassificationTests {
    static final String DUPLICATE_MESSAGE = "Já existe uma unidade com esse nome";
    static final Duration LIMIT = Duration.ofSeconds(5);

    static UnidadeRequestDTO body() {
        return UnidadeRequestDTO.builder().nome("Unidade").endereco("Endereço").telefone("(61) 0000-0000").build();
    }

    static UnidadeService service(DataSource catalog, RuntimeException failure) {
        UnidadeRepository repository = mock(UnidadeRepository.class);
        doReturn(false).when(repository).existsByNome(any());
        doThrow(failure).when(repository).saveAndFlush(any());
        UsuarioPermissions globalAdmin = mock(UsuarioPermissions.class);
        doReturn(new Usuario()).when(globalAdmin).authenticated(any());
        doReturn(true).when(globalAdmin).isGlobalAdmin(any());
        return new UnidadeService(repository, globalAdmin, mock(Validator.class), catalog);
    }

    /** Catalog with a single name constraint, as read from pg_constraint or H2's information_schema. */
    static DataSource catalog(String product, String schema, String table, String constraint) {
        try {
            DataSource dataSource = mock(DataSource.class);
            Connection connection = mock(Connection.class);
            DatabaseMetaData metadata = mock(DatabaseMetaData.class);
            PreparedStatement query = mock(PreparedStatement.class);
            ResultSet rows = mock(ResultSet.class);
            doReturn(connection).when(dataSource).getConnection();
            doReturn(metadata).when(connection).getMetaData();
            doReturn(product).when(metadata).getDatabaseProductName();
            doReturn(schema).when(connection).getSchema();
            doReturn(query).when(connection).prepareStatement(any());
            doReturn(rows).when(query).executeQuery();
            when(rows.next()).thenReturn(true, false);
            doReturn(schema).when(rows).getString(1);
            doReturn(table).when(rows).getString(2);
            doReturn(constraint).when(rows).getString(3);
            return dataSource;
        } catch (SQLException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    static void assertDuplicate(DataSource catalog, RuntimeException failure) {
        assertTimeoutPreemptively(LIMIT, () ->
            assertThatThrownBy(() -> service(catalog, failure).criar(body(), null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage(DUPLICATE_MESSAGE));
    }

    static void assertOriginalPreserved(DataSource catalog, RuntimeException failure) {
        assertTimeoutPreemptively(LIMIT, () ->
            assertThatThrownBy(() -> service(catalog, failure).criar(body(), null))
                .isSameAs(failure));
    }

    /** Spring's translation of Hibernate's conversion of the given JDBC exception. */
    static DataIntegrityViolationException spring(SQLException root, String hibernateConstraint) {
        return new DataIntegrityViolationException("could not execute statement",
            new ConstraintViolationException("could not execute statement", root, hibernateConstraint));
    }

    /** Batch container in PgJDBC's layout: the first error is both the cause and the next exception. */
    static BatchUpdateException batch(String sqlState, SQLException first) {
        BatchUpdateException container = new BatchUpdateException("Batch entry 0 was aborted", sqlState, 0, new long[0], first);
        container.setNextException(first);
        return container;
    }

    @Nested
    class PostgreSQL {
        final DataSource catalog = catalog("PostgreSQL", "public", "unidades", "unidades_nome_key");

        /** PSQLException carrying the server fields; null fields are omitted from the message. */
        static SQLException server(String sqlState, String schema, String table, String constraint) {
            StringBuilder fields = new StringBuilder("SERROR\0C").append(sqlState).append("\0Mviolation\0");
            if (schema != null) {
                fields.append('s').append(schema).append('\0');
            }
            if (table != null) {
                fields.append('t').append(table).append('\0');
            }
            if (constraint != null) {
                fields.append('n').append(constraint).append('\0');
            }
            try {
                Class<?> details = Class.forName("org.postgresql.util.ServerErrorMessage");
                return (SQLException) Class.forName("org.postgresql.util.PSQLException")
                    .getConstructor(details)
                    .newInstance(details.getConstructor(String.class).newInstance(fields.toString()));
            } catch (ReflectiveOperationException unavailable) {
                throw new IllegalStateException(unavailable);
            }
        }

        static SQLException name() {
            return server("23505", "public", "unidades", "unidades_nome_key");
        }

        static SQLException otherUnique() {
            return server("23505", "public", "unidades", "uk_unidades_telefone");
        }

        @Test
        void theNameViolationIsRecognized() {
            assertDuplicate(catalog, spring(name(), null));
        }

        @Test
        void theDriverBatchLayoutWithASharedNodeIsRecognized() {
            assertDuplicate(catalog, spring(batch("23505", name()), null));
        }

        @Test
        void containersSharingTheSameViolationAreRecognized() {
            SQLException shared = name();
            BatchUpdateException inner = batch("23505", shared);
            BatchUpdateException outer = new BatchUpdateException("outer", "23505", 0, new long[0], shared);
            outer.setNextException(inner);
            assertDuplicate(catalog, spring(outer, null));
        }

        @Test
        void aContainerWithoutSqlStateKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(batch(null, name()), null));
        }

        @Test
        void aVisitedNodeIsSkippedWithoutStoppingTheTraversal() {
            // The shared name violation is reached first through the cause and again
            // through the next exception; its own cause must still be visited.
            SQLException shared = name();
            shared.initCause(otherUnique());
            assertOriginalPreserved(catalog, spring(batch("23505", shared), null));
        }

        @Test
        void aVisitedNodeBeforeAnUnvisitedViolationInTheNextChainDoesNotStopTheTraversal() {
            SQLException shared = name();
            BatchUpdateException container = batch("23505", shared);
            SQLException later = otherUnique();
            container.setNextException(later);
            assertOriginalPreserved(catalog, spring(container, null));
        }

        // ----- mixed chains ------------------------------------------------

        @Test
        void theNameAndAnotherUniqueConstraintKeepTheOriginal() {
            SQLException first = name();
            first.setNextException(otherUnique());
            assertOriginalPreserved(catalog, spring(batch("23505", first), null));
        }

        @Test
        void theNameAndANotNullViolationKeepTheOriginal() {
            SQLException first = name();
            first.setNextException(server("23502", "public", "unidades", null));
            assertOriginalPreserved(catalog, spring(first, null));
        }

        @Test
        void theNameAndAUniqueViolationWithoutDetailsKeepTheOriginal() {
            SQLException first = name();
            first.setNextException(new SQLException("duplicate key", "23505"));
            assertOriginalPreserved(catalog, spring(batch("23505", first), null));
        }

        @Test
        void theNameAndAViolationWithoutTheConstraintFieldKeepTheOriginal() {
            SQLException first = name();
            first.setNextException(server("23505", "public", "unidades", null));
            assertOriginalPreserved(catalog, spring(first, null));
        }

        @Test
        void theSameConstraintNameInAnotherSchemaKeepsTheOriginal() {
            SQLException first = name();
            first.setNextException(server("23505", "outro", "unidades", "unidades_nome_key"));
            assertOriginalPreserved(catalog, spring(first, null));
        }

        @Test
        void aContainerWithAnotherSqlStateKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(batch("40001", name()), null));
        }

        @Test
        void hibernateNamingTheConstraintDoesNotOverrideMissingServerDetails() {
            assertOriginalPreserved(catalog, spring(new SQLException("duplicate key", "23505"), "unidades_nome_key"));
        }

        // ----- exceptions without details --------------------------------

        @Test
        void aPlainUniqueViolationWithoutDetailsKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(new SQLException("duplicate key", "23505"), null));
        }

        @Test
        void aServerViolationWithoutSchemaTableOrConstraintKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(server("23505", null, null, null), null));
        }

        @Test
        void aBatchWithoutChainedErrorsKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(
                new BatchUpdateException("Batch entry 0 was aborted", "23505", 0, new long[0], null), null));
        }

        @Test
        void anExceptionWithoutSqlStateKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(new SQLException("unknown"), null));
        }

        @Test
        void aViolationWithoutAnySqlExceptionKeepsTheOriginal() {
            assertOriginalPreserved(catalog,
                new DataIntegrityViolationException("not-null property", new IllegalStateException("nome")));
        }

        @Test
        void theCatalogIsReadAgainForEveryClassification() throws SQLException {
            DataSource reread = catalog("PostgreSQL", "public", "unidades", "unidades_nome_key");
            ResultSet rows = reread.getConnection().prepareStatement("").executeQuery();
            when(rows.next()).thenReturn(true, false, true, false);
            clearInvocations(reread);
            UnidadeService service = service(reread, spring(name(), null));
            for (int attempt = 0; attempt < 2; attempt++) {
                assertThatThrownBy(() -> service.criar(body(), null)).isInstanceOf(BusinessRuleException.class);
            }
            verify(reread, times(2)).getConnection();
        }

        @Test
        void aCatalogThatNoLongerHasTheConstraintKeepsTheOriginalForTheSameService() throws SQLException {
            DataSource changing = catalog("PostgreSQL", "public", "unidades", "unidades_nome_key");
            ResultSet rows = changing.getConnection().prepareStatement("").executeQuery();
            // First read finds the constraint; the second finds nothing (dropped after startup).
            when(rows.next()).thenReturn(true, false, false);
            DataIntegrityViolationException failure = spring(name(), null);
            UnidadeService service = service(changing, failure);

            assertThatThrownBy(() -> service.criar(body(), null)).isInstanceOf(BusinessRuleException.class);
            assertThatThrownBy(() -> service.criar(body(), null)).isSameAs(failure);
        }

        @Test
        void anUnreadableCatalogKeepsTheOriginal() throws SQLException {
            DataSource unavailable = mock(DataSource.class);
            doThrow(new SQLException("connection refused", "08001")).when(unavailable).getConnection();
            assertOriginalPreserved(unavailable, spring(name(), null));
        }

        // ----- nested causes -----------------------------------------------

        @Test
        void aDeeplyNestedNameViolationIsRecognized() {
            assertDuplicate(catalog, new DataIntegrityViolationException("outer",
                new IllegalStateException("wrapper", new ConstraintViolationException("hibernate",
                    batch("23505", name()), null))));
        }

        @Test
        void anotherViolationNestedUnderTheCauseOfTheNextExceptionKeepsTheOriginal() {
            SQLException first = name();
            SQLException next = name();
            next.initCause(new IllegalStateException("wrapper", otherUnique()));
            first.setNextException(next);
            assertOriginalPreserved(catalog, spring(first, null));
        }

        @Test
        void anotherViolationInTheNextChainOfANestedCauseKeepsTheOriginal() {
            SQLException nested = name();
            nested.setNextException(server("23503", "public", "unidades", "fk_unidades_teste"));
            SQLException first = name();
            first.initCause(nested);
            assertOriginalPreserved(catalog, spring(first, null));
        }

        // ----- cycles --------------------------------------------------------

        @Test
        void aCauseCycleOfNameViolationsTerminatesAndIsRecognized() {
            SQLException first = name();
            first.initCause(new IllegalStateException("wrapper", first));
            assertDuplicate(catalog, spring(first, null));
        }

        @Test
        void aNextExceptionCycleOfNameViolationsTerminatesAndIsRecognized() {
            SQLException first = name();
            SQLException second = name();
            first.setNextException(second);
            second.setNextException(first);
            assertDuplicate(catalog, spring(batch("23505", first), null));
        }

        @Test
        void aCycleContainingAnotherViolationKeepsTheOriginal() {
            SQLException first = name();
            SQLException other = otherUnique();
            first.setNextException(other);
            other.setNextException(first);
            other.initCause(first);
            assertOriginalPreserved(catalog, spring(first, null));
        }
    }

    @Nested
    class H2 {
        final DataSource catalog = catalog("H2", "public", "unidades", "uk_unidades_nome_index_a");
        static final String NAME = "public.uk_unidades_nome_index_a";

        static SQLException violation() {
            return new SQLException("Unique index or primary key violation", "23505");
        }

        @Test
        void theNameViolationConvertedByHibernateIsRecognized() {
            assertDuplicate(catalog, spring(violation(), NAME));
        }

        @Test
        void aViolationWithoutTheHibernateConstraintNameKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(violation(), null));
        }

        @Test
        void anotherIndexNameKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(violation(), "public.uk_unidades_telefone_index_b"));
        }

        @Test
        void aMixedChainWithAViolationHibernateDidNotNameKeepsTheOriginal() {
            SQLException named = violation();
            named.setNextException(violation());
            assertOriginalPreserved(catalog, spring(named, NAME));
        }

        @Test
        void aMixedChainWithAnotherSqlStateKeepsTheOriginal() {
            SQLException named = violation();
            named.setNextException(new SQLException("NULL not allowed", "23502"));
            assertOriginalPreserved(catalog, spring(named, NAME));
        }

        @Test
        void conflictingHibernateNamesForTheSameViolationKeepTheOriginal() {
            // Two conversions of the same exception, reached through a cycle, disagree.
            SQLException shared = violation();
            shared.initCause(new ConstraintViolationException("other", shared, "public.uk_unidades_telefone_index_b"));
            assertOriginalPreserved(catalog, spring(shared, NAME));
        }

        @Test
        void hibernateNamingOnlyTheContainerKeepsTheOriginal() {
            assertOriginalPreserved(catalog, spring(batch("23505", violation()), NAME));
        }
    }
}
