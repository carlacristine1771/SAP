package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.dto.unidade.UnidadeRequestDTO;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.security.UsuarioPermissions;
import br.com.sap.service.UnidadeService;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.AdditionalAnswers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

/**
 * Classification of database rejections when the pre-check on the unit name loses a
 * race: only the real UNIQUE constraint on unidades(nome) becomes the duplicate
 * message; any other violation keeps the original exception.
 *
 * The race is simulated by a repository that delegates to the real one but answers
 * "name is free" to the pre-checks, so the real database, Hibernate and Spring
 * produce the exception. Every test builds a new service, so the constraint catalog
 * is read from the schema as the test left it.
 */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:unit_name_uniqueness_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "jwt.secret=sap_test_secret_key_2026_with_32_chars_minimum",
    "jwt.expiration=86400000"
})
@ActiveProfiles("test")
class UnitNameUniquenessTests {
    static final String DUPLICATE_MESSAGE = "Já existe uma unidade com esse nome";

    // Never execute the application seed.
    @MockitoBean DataInitializer dataInitializer;
    @Autowired UnidadeRepository units;
    @Autowired Validator validator;
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;

    final UsuarioPermissions globalAdmin = mock(UsuarioPermissions.class);

    @BeforeEach
    void resetUnits() {
        checkDatabase();
        jdbc.update("delete from unidades");
        doReturn(new Usuario()).when(globalAdmin).authenticated(any());
        doReturn(true).when(globalAdmin).isGlobalAdmin(any());
    }

    /** Hook for subclasses to confirm the database before any change. */
    void checkDatabase() {
        assertThat(jdbc.queryForObject("select current_schema", String.class)).isEqualTo("public");
    }

    /** Service whose name pre-checks always miss, as when another request wins the race. */
    UnidadeService racingService() {
        return service(racingRepository());
    }

    UnidadeRepository racingRepository() {
        UnidadeRepository racing = mock(UnidadeRepository.class, AdditionalAnswers.delegatesTo(units));
        doReturn(false).when(racing).existsByNome(any());
        doReturn(false).when(racing).existsByNomeAndIdNot(any(), any());
        return racing;
    }

    UnidadeService service(UnidadeRepository repository) {
        return new UnidadeService(repository, globalAdmin, validator, dataSource);
    }

    Unidade persisted(String nome, String endereco, String telefone) {
        return units.saveAndFlush(Unidade.builder()
            .nome(nome).endereco(endereco).telefone(telefone).createdAt(LocalDateTime.now()).build());
    }

    static UnidadeRequestDTO body(String nome, String endereco, String telefone) {
        return UnidadeRequestDTO.builder().nome(nome).endereco(endereco).telefone(telefone).build();
    }

    /** Name of the single-column UNIQUE constraint on unidades(nome), as declared by the schema. */
    String nameConstraint() {
        return jdbc.queryForObject("""
            select tc.constraint_name
              from information_schema.table_constraints tc
              join information_schema.key_column_usage k
                on k.constraint_schema = tc.constraint_schema and k.constraint_name = tc.constraint_name
             where tc.constraint_type = 'UNIQUE' and tc.table_schema = current_schema and tc.table_name = 'unidades'
             group by tc.constraint_name
            having count(*) = 1 and max(cast(k.column_name as varchar(255))) = 'nome'
            """, String.class);
    }

    void assertOriginalPreserved(Runnable write) {
        assertThatThrownBy(write::run)
            .isInstanceOf(DataIntegrityViolationException.class)
            .isNotInstanceOf(BusinessRuleException.class);
    }

    /** Repository whose save fails with the given exception, after a missed pre-check. */
    UnidadeRepository throwing(RuntimeException failure) {
        UnidadeRepository failing = mock(UnidadeRepository.class);
        doReturn(false).when(failing).existsByNome(any());
        doThrow(failure).when(failing).saveAndFlush(any());
        return failing;
    }

    /** The exception Spring, Hibernate and the driver really produce for a duplicate name. */
    DataIntegrityViolationException realDuplicateNameFailure(String nome) {
        persisted(nome, "Endereço 1", "(61) 0000-0001");
        try {
            persisted(nome, "Endereço 2", "(61) 0000-0002");
            return fail("the database should reject the duplicate name");
        } catch (DataIntegrityViolationException expected) {
            return expected;
        }
    }

    static SQLException firstSqlException(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                return sql;
            }
        }
        return fail("no SQLException in " + failure);
    }

    // ----- catalog changes after the first classification ------------------

    @Test
    void aRenamedNameConstraintIsStillRecognizedByTheSameService() {
        String original = nameConstraint();
        UnidadeService service = racingService();
        persisted("Unidade Renomeada", "Endereço 1", "(61) 0000-0001");
        assertThatThrownBy(() -> service.criar(body("Unidade Renomeada", "Endereço 2", "(61) 0000-0002"), null))
            .isInstanceOf(BusinessRuleException.class);

        jdbc.execute("alter table unidades rename constraint \"" + original + "\" to uk_unidades_nome_renomeada_teste");
        try {
            assertThatThrownBy(() -> service.criar(body("Unidade Renomeada", "Endereço 3", "(61) 0000-0003"), null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage(DUPLICATE_MESSAGE);
        } finally {
            jdbc.execute("alter table unidades rename constraint uk_unidades_nome_renomeada_teste to \"" + original + "\"");
        }
    }

    @Test
    void theNameConstraintRecreatedOnAnotherColumnKeepsTheOriginalForTheSameService() {
        // A cached catalog would still map this constraint name to unidades(nome).
        String original = nameConstraint();
        UnidadeService service = racingService();
        persisted("Unidade Recriada", "Endereço Repetido", "(61) 0000-0001");
        assertThatThrownBy(() -> service.criar(body("Unidade Recriada", "Endereço 2", "(61) 0000-0002"), null))
            .isInstanceOf(BusinessRuleException.class);

        jdbc.execute("alter table unidades drop constraint \"" + original + "\"");
        jdbc.execute("alter table unidades add constraint \"" + original + "\" unique (endereco)");
        try {
            assertOriginalPreserved(() ->
                service.criar(body("Unidade Outra", "Endereço Repetido", "(61) 0000-0003"), null));
        } finally {
            jdbc.execute("alter table unidades drop constraint \"" + original + "\"");
            jdbc.execute("alter table unidades add constraint \"" + original + "\" unique (nome)");
        }
    }

    // ----- real exceptions in mixed chains ---------------------------------

    @Test
    void theRealDuplicateNameFailureIsRecognized() {
        DataIntegrityViolationException failure = realDuplicateNameFailure("Unidade Real");

        assertThatThrownBy(() -> service(throwing(failure)).criar(body("Unidade Real", "Endereço", "Telefone"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
    }

    @Test
    void theRealDuplicateNameFailureMixedWithAnotherViolationKeepsTheSameException() {
        DataIntegrityViolationException failure = realDuplicateNameFailure("Unidade Mista");
        firstSqlException(failure).setNextException(new SQLException("null value in column", "23502"));

        assertThatThrownBy(() -> service(throwing(failure)).criar(body("Unidade Mista", "Endereço", "Telefone"), null))
            .isSameAs(failure);
    }

    @Test
    void theRealDuplicateNameFailureWithAnUnidentifiedUniqueViolationKeepsTheSameException() {
        DataIntegrityViolationException failure = realDuplicateNameFailure("Unidade Sem Detalhes");
        firstSqlException(failure).setNextException(new SQLException("duplicate key", "23505"));

        assertThatThrownBy(() -> service(throwing(failure)).criar(body("Unidade Sem Detalhes", "Endereço", "Telefone"), null))
            .isSameAs(failure);
    }

    // ----- the real UNIQUE(nome) constraint --------------------------------

    @Test
    void createLosingTheRaceOnTheNameReturnsTheDuplicateMessage() {
        persisted("Unidade Corrida", "Endereço 1", "(61) 0000-0001");

        assertThatThrownBy(() -> racingService().criar(body("Unidade Corrida", "Endereço 2", "(61) 0000-0002"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
        assertThat(units.count()).isEqualTo(1);
    }

    @Test
    void updateLosingTheRaceOnTheNameReturnsTheDuplicateMessage() {
        persisted("Unidade Corrida", "Endereço 1", "(61) 0000-0001");
        Unidade target = persisted("Unidade Alvo", "Endereço 2", "(61) 0000-0002");

        assertThatThrownBy(() -> racingService().atualizar(target.getId(),
                body("Unidade Corrida", "Endereço 2", "(61) 0000-0002"), null))
            .isInstanceOf(BusinessRuleException.class)
            .hasMessage(DUPLICATE_MESSAGE);
        assertThat(units.findById(target.getId())).get().extracting(Unidade::getNome).isEqualTo("Unidade Alvo");
    }

    // ----- other unique rules keep the original exception ------------------

    @Test
    void anotherUniqueConstraintKeepsTheOriginalException() {
        jdbc.execute("alter table unidades add constraint uk_unidades_endereco_teste unique (endereco)");
        try {
            persisted("Unidade 1", "Endereço Repetido", "(61) 0000-0001");
            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade 2", "Endereço Repetido", "(61) 0000-0002"), null));
        } finally {
            jdbc.execute("alter table unidades drop constraint uk_unidades_endereco_teste");
        }
    }

    @Test
    void aStandaloneUniqueIndexOnAnotherColumnKeepsTheOriginalException() {
        jdbc.execute("create unique index ux_unidades_telefone_teste on unidades (telefone)");
        try {
            persisted("Unidade 1", "Endereço 1", "(61) 0000-0009");
            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade 2", "Endereço 2", "(61) 0000-0009"), null));
        } finally {
            jdbc.execute("drop index ux_unidades_telefone_teste");
        }
    }

    @Test
    void aStandaloneUniqueIndexOnTheNameIsNotTreatedAsTheConstraint() {
        String constraint = "\"" + nameConstraint() + "\"";
        jdbc.execute("alter table unidades drop constraint " + constraint);
        jdbc.execute("create unique index ux_unidades_nome_teste on unidades (nome)");
        try {
            persisted("Unidade Índice", "Endereço 1", "(61) 0000-0001");
            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade Índice", "Endereço 2", "(61) 0000-0002"), null));
        } finally {
            jdbc.execute("drop index ux_unidades_nome_teste");
            jdbc.execute("alter table unidades add constraint " + constraint + " unique (nome)");
        }
    }

    @Test
    void aCompositeUniqueConstraintIncludingTheNameKeepsTheOriginalException() {
        String constraint = "\"" + nameConstraint() + "\"";
        jdbc.execute("alter table unidades drop constraint " + constraint);
        jdbc.execute("alter table unidades add constraint uk_unidades_nome_endereco_teste unique (nome, endereco)");
        try {
            persisted("Unidade Composta", "Endereço 1", "(61) 0000-0001");
            assertOriginalPreserved(() ->
                racingService().criar(body("Unidade Composta", "Endereço 1", "(61) 0000-0002"), null));
        } finally {
            jdbc.execute("alter table unidades drop constraint uk_unidades_nome_endereco_teste");
            jdbc.execute("alter table unidades add constraint " + constraint + " unique (nome)");
        }
    }
}
