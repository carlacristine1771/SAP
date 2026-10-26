package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.Aluno;
import br.com.sap.entity.Curso;
import br.com.sap.entity.Turma;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.entity.enums.Turno;
import br.com.sap.repository.AlunoRepository;
import br.com.sap.repository.CursoRepository;
import br.com.sap.repository.TurmaRepository;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.JwtService;
import br.com.sap.security.SecurityConstants;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.servlet.http.Cookie;
import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit write authorization (D1-D4), expressing the target behavior:
 * only the global administrator creates and edits units; DELETE is disabled for
 * everyone; input is limited to nome/endereco/telefone (extra properties ignored);
 * invalid input and conflicts return 400 without SQL details.
 *
 * Every request is performed without inline HTTP expectations. Status, response
 * body and persisted state (all units plus the unit links of users, courses,
 * classes and students) are checked together with soft assertions, so a wrong
 * status never hides a persisted change.
 *
 * Isolation, in three layers:
 * 1. {@link IsolatedDatabaseGuard} validates the DataSource inside the Spring context
 *    before Hibernate starts (the EntityManagerFactory depends on it), so schema DDL
 *    can never run against anything but the authorized in-memory H2 database.
 * 2. {@link #verifyEffectiveContextIsIsolatedH2} re-checks the effective context once.
 * 3. Before each test, on one single JDBC connection that is validated first, every
 *    table is truncated with referential integrity temporarily disabled; integrity is
 *    restored in finally and verified by behavior. Any failure stops all later tests.
 * A transactional rollback is deliberately not used: it would defer flushes and hide
 * the constraint violations these tests must observe. Application seed disabled.
 *
 * Concurrency: the class runs isolated from every other test class (@Isolated) and its
 * methods on a single thread, even if JUnit parallel execution is enabled. The in-memory
 * database and this context exist only inside one JVM, so Gradle forks cannot share them.
 */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=" + UnitManagementPermissionsTests.DATASOURCE_URL,
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "jwt.secret=sap_test_secret_key_2026_with_32_chars_minimum",
    "jwt.expiration=86400000"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Isolated("Shares and truncates the in-memory H2 database " + UnitManagementPermissionsTests.DATABASE_NAME)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(UnitManagementPermissionsTests.DATABASE_LOCK)
class UnitManagementPermissionsTests {
    /** The only database this class may create, use or reset. */
    static final String DATABASE_NAME = "unit_management_test";
    static final String DATABASE_LOCK = "sap.h2." + DATABASE_NAME;
    private static final String AUTHORIZED_URL_BASE = "jdbc:h2:mem:" + DATABASE_NAME;
    /** Legitimate H2 parameters of the configured URL (keys compared case-insensitively). */
    private static final Set<String> AUTHORIZED_URL_PARAMETERS =
        Set.of("MODE=POSTGRESQL", "DB_CLOSE_DELAY=-1", "DATABASE_TO_LOWER=TRUE");
    static final String DATASOURCE_URL =
        "jdbc:h2:mem:unit_management_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE";
    /** H2 SQLState for a foreign key pointing to a missing parent row. */
    private static final String FK_PARENT_MISSING = "23506";
    private static final AtomicBoolean GUARD_VERIFIED_CONNECTION = new AtomicBoolean();
    /** First isolation failure; once set, every later test refuses to run. */
    private static volatile Throwable isolationFailure;

    private static final AtomicInteger SEQUENCE = new AtomicInteger();
    private static final String NOT_INFORMED = "Não informado";
    private static final String OWN_PHONE = "(61) 0000-0001";
    private static final String DUPLICATE_MESSAGE = "Já existe uma unidade com esse nome";
    private static final String FIRST_ACCESS_MESSAGE = "Troque a senha temporária antes de acessar o sistema.";
    private static final List<String> SQL_FRAGMENTS = List.of("sql", "constraint", "could not", "insert into",
        "update unidades", "delete from", "jdbc", "hibernate", "value too long", "unique index");
    /** Server timestamps are compared within the request window, tolerant to database rounding. */
    private static final long TIMESTAMP_TOLERANCE_MILLIS = 1;

    // Never execute the application seed.
    @MockitoBean DataInitializer dataInitializer;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository users;
    @Autowired UnidadeRepository units;
    @Autowired CursoRepository courses;
    @Autowired TurmaRepository classes;
    @Autowired AlunoRepository students;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired DataSource dataSource;

    // ----- isolation guards -------------------------------------------------

    /**
     * Runs inside the Spring context while beans are created. The DataSource is fully
     * post-processed before it can be injected into the EntityManagerFactory, so these
     * checks happen before Hibernate starts and before any schema DDL. Any mismatch
     * aborts context startup.
     */
    @TestConfiguration(proxyBeanMethods = false)
    static class IsolatedDatabaseGuard {
        @Bean
        static BeanPostProcessor isolatedH2DataSourceGuard() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessBeforeInitialization(Object bean, String beanName) {
                    if (bean instanceof DataSource) requireAuthorizedConfiguredDataSource(bean, beanName);
                    return bean;
                }

                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    if (bean instanceof DataSource source) {
                        requireAuthorizedConfiguredDataSource(bean, beanName);
                        try (Connection connection = source.getConnection()) {
                            requireAuthorizedConnection(connection);
                        } catch (SQLException unreachable) {
                            throw new IllegalStateException("Could not verify DataSource '" + beanName + "'", unreachable);
                        }
                        GUARD_VERIFIED_CONNECTION.set(true);
                    }
                    return bean;
                }
            };
        }
    }

    private static void requireAuthorizedConfiguredDataSource(Object bean, String beanName) {
        if (!(bean instanceof HikariDataSource hikari)) {
            throw new IllegalStateException("Unexpected DataSource type for '" + beanName + "': " + bean.getClass().getName());
        }
        if (!DATASOURCE_URL.equals(hikari.getJdbcUrl()) || !isAuthorizedUrl(hikari.getJdbcUrl())) {
            throw new IllegalStateException("DataSource '" + beanName + "' is not the authorized in-memory H2 database");
        }
    }

    /** Exact database name plus only the legitimate parameters; anything else is rejected. */
    private static boolean isAuthorizedUrl(String url) {
        if (url == null) return false;
        String[] parts = url.split(";", -1);
        if (!AUTHORIZED_URL_BASE.equals(parts[0])) return false;
        Set<String> seen = new TreeSet<>();
        for (int i = 1; i < parts.length; i++) {
            String parameter = parts[i].trim().toUpperCase(Locale.ROOT);
            if (!AUTHORIZED_URL_PARAMETERS.contains(parameter) || !seen.add(parameter)) return false;
        }
        return true;
    }

    /** Validates a live connection: H2 product, authorized URL, exact database name, in memory. */
    private static void requireAuthorizedConnection(Connection connection) throws SQLException {
        String product = connection.getMetaData().getDatabaseProductName();
        String url = connection.getMetaData().getURL();
        if (!"H2".equals(product) || !isAuthorizedUrl(url)) {
            throw new IllegalStateException("Connection is not the authorized in-memory H2 database (product " + product + ")");
        }
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT DATABASE(), DATABASE_PATH()")) {
            if (!result.next()) throw new IllegalStateException("Could not read the database identity");
            String name = result.getString(1);
            String path = result.getString(2);
            if (!DATABASE_NAME.equalsIgnoreCase(name) || path != null) {
                throw new IllegalStateException("Connected database is not the in-memory " + DATABASE_NAME);
            }
        }
    }

    /** Effective configuration check, once, after the guarded context started. */
    @BeforeAll
    static void verifyEffectiveContextIsIsolatedH2(ApplicationContext context) {
        Map<String, DataSource> sources = context.getBeansOfType(DataSource.class);
        Map<String, LocalContainerEntityManagerFactoryBean> factories =
            context.getBeansOfType(LocalContainerEntityManagerFactoryBean.class);
        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(GUARD_VERIFIED_CONNECTION.get()).as("guard verified a live connection before Hibernate").isTrue();
        softly.assertThat(context.getEnvironment().getProperty("spring.datasource.url")).as("effective URL").isEqualTo(DATASOURCE_URL);
        softly.assertThat(context.getEnvironment().getProperty("spring.datasource.driver-class-name")).as("effective driver").isEqualTo("org.h2.Driver");
        softly.assertThat(sources).as("DataSource beans").hasSize(1);
        softly.assertThat(factories).as("EntityManagerFactory beans").hasSize(1);
        if (sources.size() == 1 && factories.size() == 1) {
            DataSource only = sources.values().iterator().next();
            softly.assertThat(only).as("DataSource type").isInstanceOf(HikariDataSource.class);
            softly.assertThat(factories.values().iterator().next().getDataSource()).as("Hibernate DataSource").isSameAs(only);
        }
        softly.assertAll();
    }

    /** The five SAP profiles, including both administrator representations. */
    enum Actor {
        GLOBAL_ADMIN(TipoUsuario.ADMINISTRADOR, false),
        UNIT_ADMIN_LEGACY(TipoUsuario.ADMINISTRADOR, true),
        UNIT_ADMIN(TipoUsuario.ADMIN_UNIDADE, true),
        UNIT_ADMIN_WITHOUT_UNIT(TipoUsuario.ADMIN_UNIDADE, false),
        COORDENACAO(TipoUsuario.COORDENACAO, true),
        PSICOLOGO(TipoUsuario.PSICOLOGO, true),
        INSTRUTOR(TipoUsuario.INSTRUTOR, true);

        final TipoUsuario role;
        final boolean linkedToUnit;

        Actor(TipoUsuario role, boolean linkedToUnit) {
            this.role = role;
            this.linkedToUnit = linkedToUnit;
        }
    }

    /** UPDATE_OWN and DELETE_LINKED target unit A, the actors' unit with linked records. */
    enum Operation { CREATE, UPDATE_OWN, UPDATE_OTHER, DELETE_EMPTY, DELETE_LINKED }

    @FunctionalInterface
    interface Credential {
        MockHttpServletRequestBuilder apply(MockHttpServletRequestBuilder request);
    }

    private static final Credential ANONYMOUS = request -> request;

    record UnitRow(String nome, String endereco, String telefone, LocalDateTime createdAt) {}

    record State(Map<Long, UnitRow> units, Map<String, String> links) {}

    int run;
    Unidade own;      // unit A: actors, course, class and student linked to it
    Unidade other;    // unit B: another unit
    Unidade empty;    // unit C: no links
    final Map<Actor, Usuario> accounts = new EnumMap<>(Actor.class);

    @BeforeEach
    void createIsolatedFixture() throws Exception {
        resetIsolatedDatabase();
        run = SEQUENCE.incrementAndGet();
        own = unit("Unidade Ficticia A #" + run, OWN_PHONE);
        other = unit("Unidade Ficticia B #" + run, NOT_INFORMED);
        empty = unit("Unidade Ficticia C #" + run, NOT_INFORMED);
        accounts.clear();
        for (Actor actor : Actor.values()) {
            accounts.put(actor, account(actor.name().toLowerCase(Locale.ROOT).replace('_', '-'),
                actor.role, actor.linkedToUnit ? own : null, false));
        }
        Curso course = courses.saveAndFlush(Curso.builder().nome("Curso Ficticio #" + run).unidade(own).build());
        Turma turma = classes.saveAndFlush(Turma.builder().nome("Turma Ficticia #" + run).turno(Turno.MATUTINO)
            .curso(course).unidade(own).instrutor(accounts.get(Actor.INSTRUTOR)).build());
        students.saveAndFlush(Aluno.builder().nome("Aluno Ficticio #" + run)
            .cpf(String.format("%011d", 90_000_000_000L + run)).dataNascimento(LocalDate.of(2005, 1, 1))
            .telefone(NOT_INFORMED).responsavel("Responsavel Ficticio").turno(Turno.MATUTINO)
            .unidade(own).curso(course).turma(turma).build());
    }

    /**
     * Empties every table of the isolated database. Validation and every destructive
     * statement use the same JDBC connection; nothing destructive runs unless that very
     * connection is the authorized in-memory H2 database. Any failure is recorded and
     * stops all later tests, so none runs on an unknown database state.
     */
    private void resetIsolatedDatabase() {
        Throwable earlier = isolationFailure;
        if (earlier != null) {
            throw new IllegalStateException("Isolation failed in an earlier test; refusing to run with an unknown database state", earlier);
        }
        try {
            truncateOnOneValidatedConnection();
        } catch (Throwable failure) {
            isolationFailure = failure;
            throw new IllegalStateException("Could not prepare the isolated database; later tests will not run", failure);
        }
    }

    private void truncateOnOneValidatedConnection() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            requireAuthorizedConnection(connection);
            boolean originalAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(true);
            try (Statement statement = connection.createStatement()) {
                List<String> tables = baseTables(connection);
                statement.execute("SET REFERENTIAL_INTEGRITY FALSE");
                Throwable cleaningFailure = null;
                try {
                    for (String table : tables) statement.execute("TRUNCATE TABLE " + quoted(table));
                } catch (SQLException | RuntimeException | Error failure) {
                    cleaningFailure = failure;
                    throw failure;
                } finally {
                    restoreReferentialIntegrity(connection, statement, cleaningFailure);
                }
            } finally {
                connection.setAutoCommit(originalAutoCommit);
            }
        }
    }

    private static List<String> baseTables(Connection connection) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES"
                + " WHERE UPPER(TABLE_SCHEMA) = 'PUBLIC' AND TABLE_TYPE = 'BASE TABLE'");
             ResultSet result = query.executeQuery()) {
            while (result.next()) tables.add(result.getString(1));
        }
        return tables;
    }

    private static String quoted(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /** Re-enables integrity on the same connection and proves it is enforced; otherwise aborts. */
    private static void restoreReferentialIntegrity(Connection connection, Statement statement, Throwable cleaningFailure) {
        try {
            statement.execute("SET REFERENTIAL_INTEGRITY TRUE");
            requireReferentialIntegrityEnforced(connection);
        } catch (Exception | Error restoreFailure) {
            IllegalStateException broken = new IllegalStateException(
                "Referential integrity could not be restored or verified on " + DATABASE_NAME
                    + "; aborting test preparation", restoreFailure);
            if (cleaningFailure != null) broken.addSuppressed(cleaningFailure);
            throw broken;
        }
    }

    /**
     * H2 does not expose REFERENTIAL_INTEGRITY in INFORMATION_SCHEMA, so it is verified by
     * behavior: inside a rolled-back transaction, a course pointing to a missing unit must
     * be rejected with the foreign key SQLState.
     */
    private static void requireReferentialIntegrityEnforced(Connection connection) throws SQLException {
        connection.setAutoCommit(false);
        try (Statement probe = connection.createStatement()) {
            probe.executeUpdate("INSERT INTO cursos (nome, ativo, unidade_id, created_at)"
                + " VALUES ('integrity-probe', TRUE, -1, CURRENT_TIMESTAMP)");
            throw new IllegalStateException("Referential integrity is not enforced after restoration");
        } catch (SQLException expected) {
            if (!FK_PARENT_MISSING.equals(expected.getSQLState())) {
                throw new IllegalStateException("Unexpected error while verifying referential integrity", expected);
            }
        } finally {
            connection.rollback();
            connection.setAutoCommit(true);
        }
    }

    private Unidade unit(String name, String phone) {
        Long id = units.saveAndFlush(Unidade.builder().nome(name).endereco("Endereço fictício").telefone(phone).build()).getId();
        // Re-read so the baseline carries the database timestamp precision.
        return units.findById(id).orElseThrow();
    }

    private Usuario account(String slug, TipoUsuario role, Unidade unit, boolean temporary) {
        String login = "u" + run + "-" + slug;
        Usuario user = new Usuario();
        user.setNome("Fictional Test Account");
        user.setEmail(login + "@example.invalid");
        user.setUsuario(login);
        user.setSenha(encoder.encode("fictional-test"));
        user.setTipoUsuario(role);
        user.setUnidade(unit);
        user.setAtivo(true);
        user.setSenhaTemporaria(temporary);
        return users.saveAndFlush(user);
    }

    // ----- parameter sources -----------------------------------------------

    private static final List<String> TRANSPORTS = List.of("bearer", "cookie");
    private static final List<Operation> WRITES = List.of(Operation.CREATE, Operation.UPDATE_OWN, Operation.UPDATE_OTHER);
    private static final List<Operation> DELETES = List.of(Operation.DELETE_EMPTY, Operation.DELETE_LINKED);

    private static Stream<Arguments> combine(List<Actor> actors, List<Operation> operations) {
        return actors.stream().flatMap(actor -> operations.stream().flatMap(operation ->
            TRANSPORTS.stream().map(transport -> Arguments.of(actor, operation, transport))));
    }

    private static Stream<Arguments> combine(List<Operation> operations) {
        return operations.stream().flatMap(operation ->
            TRANSPORTS.stream().map(transport -> Arguments.of(operation, transport)));
    }

    static Stream<Arguments> deniedWrites() {
        return combine(Arrays.stream(Actor.values()).filter(actor -> actor != Actor.GLOBAL_ADMIN).toList(), WRITES);
    }

    static Stream<Arguments> deletesByEveryProfile() {
        return combine(List.of(Actor.values()), DELETES);
    }

    static Stream<Arguments> everyOperation() {
        return combine(List.of(Operation.values()));
    }

    static Stream<Arguments> writes() {
        return combine(WRITES);
    }

    static Stream<Arguments> legitimateWrites() {
        return combine(List.of(Operation.CREATE, Operation.UPDATE_OTHER));
    }

    // ----- request helpers -------------------------------------------------

    private Credential credential(Usuario user, String transport) {
        return withToken(jwt.generateToken(user), transport);
    }

    private static Credential withToken(String token, String transport) {
        return request -> "bearer".equals(transport) ? request.header("Authorization", "Bearer " + token)
            : request.cookie(new Cookie(SecurityConstants.AUTH_COOKIE, token));
    }

    private Credential globalAdmin(String transport) {
        return credential(accounts.get(Actor.GLOBAL_ADMIN), transport);
    }

    private static String path(Unidade unit) {
        return "/unidades/" + unit.getId();
    }

    /** Exactly what AdminPage sends: nome, endereco and the existing (or default) telefone. */
    private static Map<String, Object> adminPageBody(String nome, String telefone) {
        Map<String, Object> body = new HashMap<>();
        body.put("nome", nome);
        body.put("endereco", "Região fictícia");
        body.put("telefone", telefone);
        return body;
    }

    private MvcResult send(MockHttpServletRequestBuilder request, String path, Map<String, ?> body, Credential credential) throws Exception {
        request.servletPath(path);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(credential.apply(request)).andReturn();
    }

    private MvcResult create(Map<String, ?> body, Credential credential) throws Exception {
        return send(post("/unidades"), "/unidades", body, credential);
    }

    private MvcResult update(Unidade target, Map<String, ?> body, Credential credential) throws Exception {
        return send(put(path(target)), path(target), body, credential);
    }

    private String requestedName() {
        return "Unidade Solicitada #" + run;
    }

    private MvcResult attempt(Operation operation, Credential credential) throws Exception {
        return switch (operation) {
            case CREATE -> create(adminPageBody(requestedName(), NOT_INFORMED), credential);
            case UPDATE_OWN -> update(own, adminPageBody("A Renomeada #" + run, OWN_PHONE), credential);
            case UPDATE_OTHER -> update(other, adminPageBody("B Renomeada #" + run, NOT_INFORMED), credential);
            case DELETE_EMPTY -> send(delete(path(empty)), path(empty), null, credential);
            case DELETE_LINKED -> send(delete(path(own)), path(own), null, credential);
        };
    }

    // ----- state and response inspection -----------------------------------

    private State capture() {
        Map<Long, UnitRow> unitRows = new TreeMap<>();
        units.findAll().forEach(u -> unitRows.put(u.getId(),
            new UnitRow(u.getNome(), u.getEndereco(), u.getTelefone(), u.getCreatedAt())));
        Map<String, String> links = new TreeMap<>();
        users.findAll().forEach(u -> links.put("usuario " + u.getId() + " -> unidade", idOf(u.getUnidade())));
        courses.findAll().forEach(c -> links.put("curso " + c.getId() + " -> unidade", idOf(c.getUnidade())));
        classes.findAll().forEach(t -> {
            links.put("turma " + t.getId() + " -> unidade", idOf(t.getUnidade()));
            links.put("turma " + t.getId() + " -> curso", t.getCurso() == null ? null : String.valueOf(t.getCurso().getId()));
        });
        students.findAll().forEach(a -> {
            links.put("aluno " + a.getId() + " -> unidade", idOf(a.getUnidade()));
            links.put("aluno " + a.getId() + " -> curso", a.getCurso() == null ? null : String.valueOf(a.getCurso().getId()));
            links.put("aluno " + a.getId() + " -> turma", a.getTurma() == null ? null : String.valueOf(a.getTurma().getId()));
        });
        return new State(unitRows, links);
    }

    private static String idOf(Unidade unit) {
        return unit == null ? null : String.valueOf(unit.getId());
    }

    /** Every difference between two states, except rows of the explicitly allowed units. */
    private static List<String> changes(State before, State after, Set<Long> allowedUnits) {
        List<String> found = new ArrayList<>();
        compare("unidade", before.units(), after.units(), allowedUnits, found);
        compare("vinculo", before.links(), after.links(), Set.of(), found);
        return found;
    }

    /**
     * Distinguishes a missing key, a key present with a null value and a key with a
     * different value: two states are never equal just because get() returns null in both.
     */
    private static <K extends Comparable<K>, V> void compare(String label, Map<K, V> before, Map<K, V> after,
                                                             Set<K> skipped, List<String> found) {
        Set<K> keys = new TreeSet<>(before.keySet());
        keys.addAll(after.keySet());
        for (K key : keys) {
            if (skipped.contains(key)) continue;
            boolean existed = before.containsKey(key);
            boolean exists = after.containsKey(key);
            if (existed && !exists) {
                found.add(label + " " + key + ": removido (antes=" + before.get(key) + ")");
            } else if (!existed && exists) {
                found.add(label + " " + key + ": criado (depois=" + after.get(key) + ")");
            } else if (!Objects.equals(before.get(key), after.get(key))) {
                found.add(label + " " + key + ": antes=" + before.get(key) + " depois=" + after.get(key));
            }
        }
    }

    private static Set<Long> newUnitIds(State before, State after) {
        return after.units().keySet().stream().filter(id -> !before.units().containsKey(id)).collect(Collectors.toSet());
    }

    /** Response body as text; an empty or unreadable body becomes "" instead of an exception. */
    private static String body(MvcResult result) {
        try {
            String text = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
            return text == null ? "" : text;
        } catch (Exception unreadable) {
            return "";
        }
    }

    private static List<String> sqlLeaks(String body) {
        String lower = body.toLowerCase(Locale.ROOT);
        return SQL_FRAGMENTS.stream().filter(lower::contains).toList();
    }

    /** Parsed body; empty or non-JSON bodies become a missing node, so path() lookups stay safe. */
    private JsonNode jsonOf(MvcResult result) {
        String text = body(result);
        if (text.isBlank()) return MissingNode.getInstance();
        try {
            JsonNode node = json.readTree(text);
            return node == null ? MissingNode.getInstance() : node;
        } catch (Exception notJson) {
            return MissingNode.getInstance();
        }
    }

    private String messageOf(MvcResult result) {
        JsonNode message = jsonOf(result).path("message");
        return message.isMissingNode() || message.isNull() ? null : message.asText();
    }

    /** Numeric id from the response, or null when absent, so it never equals a real id by accident. */
    private Long responseId(MvcResult result) {
        JsonNode id = jsonOf(result).path("id");
        return id.isIntegralNumber() ? id.asLong() : null;
    }

    private static boolean withinWindow(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null
            && !value.isBefore(start.minus(TIMESTAMP_TOLERANCE_MILLIS, ChronoUnit.MILLIS))
            && !value.isAfter(end.plus(TIMESTAMP_TOLERANCE_MILLIS, ChronoUnit.MILLIS));
    }

    private static LocalDateTime parseTimestamp(JsonNode node) {
        try {
            return node == null || node.isNull() ? null : LocalDateTime.parse(node.asText());
        } catch (Exception invalid) {
            return null;
        }
    }

    /** Status, SQL leakage and persisted state are always all verified. */
    private void assertRejectedWithoutChanges(MvcResult result, int expectedStatus, String expectedMessage, State before) throws Exception {
        State after = capture();
        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(expectedStatus);
        softly.assertThat(sqlLeaks(body(result))).as("SQL details in the response body").isEmpty();
        if (expectedMessage != null) softly.assertThat(messageOf(result)).as("message").isEqualTo(expectedMessage);
        softly.assertThat(changes(before, after, Set.of())).as("persisted changes").isEmpty();
        softly.assertAll();
    }

    // ----- D1: only the global administrator creates and edits -------------

    @ParameterizedTest(name = "negado: {0} {1} via {2}")
    @MethodSource("deniedWrites")
    void deniedProfilesCannotWriteUnits(Actor actor, Operation operation, String transport) throws Exception {
        State before = capture();
        MvcResult result = attempt(operation, credential(accounts.get(actor), transport));
        assertRejectedWithoutChanges(result, 403, null, before);
    }

    @ParameterizedTest(name = "admin global cria via {0}")
    @ValueSource(strings = {"bearer", "cookie"})
    void globalAdminCreatesWithTheAdminPageContract(String transport) throws Exception {
        String name = "Unidade Nova #" + run;
        State before = capture();
        LocalDateTime start = LocalDateTime.now();
        MvcResult result = create(adminPageBody(name, NOT_INFORMED), globalAdmin(transport));
        LocalDateTime end = LocalDateTime.now();
        State after = capture();
        JsonNode response = jsonOf(result);
        Set<Long> added = newUnitIds(before, after);
        UnitRow saved = added.size() == 1 ? after.units().get(added.iterator().next()) : null;

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        softly.assertThat(responseId(result)).as("response id").isNotNull().isIn(added);
        softly.assertThat(response.path("nome").asText()).isEqualTo(name);
        softly.assertThat(response.path("endereco").asText()).isEqualTo("Região fictícia");
        softly.assertThat(response.path("telefone").asText()).isEqualTo(NOT_INFORMED);
        softly.assertThat(response.has("usuarios")).as("usuarios exposed").isFalse();
        softly.assertThat(response.has("alunos")).as("alunos exposed").isFalse();
        softly.assertThat(withinWindow(parseTimestamp(response.get("createdAt")), start, end)).as("response createdAt within request window").isTrue();
        softly.assertThat(saved).as("persisted row").isNotNull();
        if (saved != null) {
            softly.assertThat(saved.nome()).isEqualTo(name);
            softly.assertThat(saved.telefone()).isEqualTo(NOT_INFORMED);
            softly.assertThat(withinWindow(saved.createdAt(), start, end)).as("persisted createdAt within request window").isTrue();
        }
        softly.assertThat(changes(before, after, added)).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    @ParameterizedTest(name = "admin global edita via {0}")
    @ValueSource(strings = {"bearer", "cookie"})
    void globalAdminUpdatesWithTheAdminPageContractPreservingThePhone(String transport) throws Exception {
        Map<String, Object> body = adminPageBody("A Editada #" + run, OWN_PHONE);
        body.put("endereco", "Região editada");
        State before = capture();
        MvcResult result = update(own, body, globalAdmin(transport));
        State after = capture();
        JsonNode response = jsonOf(result);
        UnitRow edited = after.units().get(own.getId());

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(responseId(result)).as("response id").isEqualTo(own.getId());
        softly.assertThat(response.path("telefone").asText()).isEqualTo(OWN_PHONE);
        softly.assertThat(edited).isEqualTo(new UnitRow("A Editada #" + run, "Região editada", OWN_PHONE, own.getCreatedAt()));
        softly.assertThat(changes(before, after, Set.of(own.getId()))).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    // ----- D2: DELETE disabled for everyone, data preserved ----------------

    @ParameterizedTest(name = "delete: {0} {1} via {2}")
    @MethodSource("deletesByEveryProfile")
    void deleteIsDisabledForEveryAuthenticatedProfile(Actor actor, Operation operation, String transport) throws Exception {
        State before = capture();
        MvcResult result = attempt(operation, credential(accounts.get(actor), transport));
        assertRejectedWithoutChanges(result, 403, null, before);
    }

    // ----- authentication and first access are preserved -------------------

    @ParameterizedTest(name = "senha temporaria: {0} via {1}")
    @MethodSource("everyOperation")
    void temporaryPasswordKeepsTheFirstAccessBlock(Operation operation, String transport) throws Exception {
        Usuario temporary = account("temporary-admin", TipoUsuario.ADMINISTRADOR, null, true);
        State before = capture();
        MvcResult result = attempt(operation, credential(temporary, transport));
        assertRejectedWithoutChanges(result, 403, FIRST_ACCESS_MESSAGE, before);
    }

    @ParameterizedTest(name = "anonimo: {0}")
    @EnumSource(Operation.class)
    void anonymousRequestsAreUnauthorized(Operation operation) throws Exception {
        State before = capture();
        MvcResult result = attempt(operation, ANONYMOUS);
        assertRejectedWithoutChanges(result, 401, null, before);
    }

    @ParameterizedTest(name = "conta inativa: {0} via {1}")
    @MethodSource("everyOperation")
    void inactiveAccountTokenIsRejected(Operation operation, String transport) throws Exception {
        Usuario admin = account("inactive-admin", TipoUsuario.ADMINISTRADOR, null, false);
        Credential issued = credential(admin, transport);
        admin.setAtivo(false);
        users.saveAndFlush(admin);
        State before = capture();
        MvcResult result = attempt(operation, issued);
        assertRejectedWithoutChanges(result, 401, null, before);
    }

    @ParameterizedTest(name = "rebaixado apos token: {0} via {1}")
    @MethodSource("writes")
    void globalAdminDemotedAfterTokenIssueIsDenied(Operation operation, String transport) throws Exception {
        Usuario admin = account("demoted-admin", TipoUsuario.ADMINISTRADOR, null, false);
        Credential issued = credential(admin, transport);
        admin.setTipoUsuario(TipoUsuario.INSTRUTOR);
        admin.setUnidade(own);
        users.saveAndFlush(admin);
        State before = capture();
        MvcResult result = attempt(operation, issued);
        assertRejectedWithoutChanges(result, 403, null, before);
    }

    @ParameterizedTest(name = "vinculado a unidade apos token: {0} via {1}")
    @MethodSource("writes")
    void globalAdminLinkedToAUnitAfterTokenIssueIsDenied(Operation operation, String transport) throws Exception {
        // Linking the account to a unit turns it into a (legacy) unit administrator.
        Usuario admin = account("linked-admin", TipoUsuario.ADMINISTRADOR, null, false);
        Credential issued = credential(admin, transport);
        admin.setUnidade(own);
        users.saveAndFlush(admin);
        State before = capture();
        MvcResult result = attempt(operation, issued);
        assertRejectedWithoutChanges(result, 403, null, before);
    }

    @ParameterizedTest(name = "promovido apos token: {0} via {1}")
    @MethodSource("legitimateWrites")
    void instructorPromotedToGlobalAdminAfterTokenIssueUsesCurrentProfile(Operation operation, String transport) throws Exception {
        // Authorization reads the current account, as the P0 policy does; token claims are not trusted.
        Usuario promoted = account("promoted", TipoUsuario.INSTRUTOR, own, false);
        String token = jwt.generateToken(promoted);
        String roleClaim = jwt.extractClaim(token, claims -> claims.get("role", String.class));
        promoted.setTipoUsuario(TipoUsuario.ADMINISTRADOR);
        promoted.setUnidade(null);
        users.saveAndFlush(promoted);
        Usuario current = users.findById(promoted.getId()).orElseThrow();
        State before = capture();
        LocalDateTime start = LocalDateTime.now();
        MvcResult result = attempt(operation, withToken(token, transport));
        LocalDateTime end = LocalDateTime.now();
        State after = capture();
        Set<Long> added = newUnitIds(before, after);
        Set<Long> allowed = new TreeSet<>(added);
        if (operation == Operation.UPDATE_OTHER) allowed.add(other.getId());

        SoftAssertions softly = new SoftAssertions();
        // Preconditions: the token still claims INSTRUTOR, the database says global administrator.
        softly.assertThat(roleClaim).as("role claim inside the token").isEqualTo("INSTRUTOR");
        softly.assertThat(current.getTipoUsuario()).as("current profile").isEqualTo(TipoUsuario.ADMINISTRADOR);
        softly.assertThat(current.getUnidade()).as("current unit link").isNull();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        if (operation == Operation.CREATE) {
            softly.assertThat(added).as("exactly one new unit").hasSize(1);
            softly.assertThat(responseId(result)).as("response id").isNotNull().isIn(added);
            for (Long id : added) {
                UnitRow created = after.units().get(id);
                softly.assertThat(created.nome()).as("created nome").isEqualTo(requestedName());
                softly.assertThat(created.endereco()).as("created endereco").isEqualTo("Região fictícia");
                softly.assertThat(created.telefone()).as("created telefone").isEqualTo(NOT_INFORMED);
                softly.assertThat(withinWindow(created.createdAt(), start, end)).as("created createdAt within request window").isTrue();
            }
        } else {
            softly.assertThat(added).as("new units").isEmpty();
            softly.assertThat(responseId(result)).as("response id").isEqualTo(other.getId());
            softly.assertThat(after.units().get(other.getId())).as("edited unit B")
                .isEqualTo(new UnitRow("B Renomeada #" + run, "Região fictícia", NOT_INFORMED, other.getCreatedAt()));
        }
        softly.assertThat(changes(before, after, allowed)).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    // ----- input limited to nome/endereco/telefone -------------------------

    @Test
    void createWithForgedIdLeavesTheExistingUnitUntouched() throws Exception {
        Map<String, Object> body = adminPageBody("Unidade Com Id Forjado #" + run, NOT_INFORMED);
        body.put("id", other.getId());
        State before = capture();
        MvcResult result = create(body, globalAdmin("bearer"));
        State after = capture();

        // Independent of the HTTP outcome: the targeted existing unit must not change.
        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(after.units().get(other.getId())).as("existing unit B").isEqualTo(before.units().get(other.getId()));
        softly.assertThat(changes(before, after, newUnitIds(before, after))).as("persisted changes to existing data").isEmpty();
        softly.assertThat(sqlLeaks(body(result))).as("SQL details in the response body").isEmpty();
        softly.assertAll();
    }

    @ParameterizedTest(name = "id + createdAt forjados via {0}")
    @ValueSource(strings = {"bearer", "cookie"})
    void createWithForgedIdAndCreationDateCreatesANewUnitAndIgnoresBoth(String transport) throws Exception {
        // Extra properties are ignored in a controlled way (200), never rejected with 400.
        String name = "Unidade Forjada Completa #" + run;
        Map<String, Object> body = adminPageBody(name, NOT_INFORMED);
        body.put("id", other.getId());
        body.put("createdAt", "2000-01-01T00:00:00");
        State before = capture();
        LocalDateTime start = LocalDateTime.now();
        MvcResult result = create(body, globalAdmin(transport));
        LocalDateTime end = LocalDateTime.now();
        State after = capture();
        Set<Long> added = newUnitIds(before, after);

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        softly.assertThat(added).as("new unit id").doesNotContain(other.getId());
        softly.assertThat(responseId(result)).as("response id").isNotNull().isNotEqualTo(other.getId()).isIn(added);
        softly.assertThat(after.units().get(other.getId())).as("existing unit B").isEqualTo(before.units().get(other.getId()));
        for (Long id : added) {
            UnitRow created = after.units().get(id);
            softly.assertThat(created.nome()).as("created nome").isEqualTo(name);
            softly.assertThat(withinWindow(created.createdAt(), start, end))
                .as("persisted createdAt %s within request window", created.createdAt()).isTrue();
        }
        softly.assertThat(withinWindow(parseTimestamp(jsonOf(result).get("createdAt")), start, end))
            .as("response createdAt within request window").isTrue();
        softly.assertThat(sqlLeaks(body(result))).as("SQL details in the response body").isEmpty();
        softly.assertThat(changes(before, after, added)).as("other units and relationships").isEmpty();
        softly.assertAll();
    }

    @Test
    void createWithForgedIdPersistsANewUnit() throws Exception {
        String name = "Unidade Com Id Forjado #" + run;
        Map<String, Object> body = adminPageBody(name, NOT_INFORMED);
        body.put("id", other.getId());
        State before = capture();
        MvcResult result = create(body, globalAdmin("bearer"));
        State after = capture();
        Set<Long> added = newUnitIds(before, after);

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        softly.assertThat(added).as("new unit id").doesNotContain(other.getId());
        added.forEach(id -> softly.assertThat(after.units().get(id).nome()).isEqualTo(name));
        softly.assertThat(responseId(result)).as("response id").isNotNull().isNotEqualTo(other.getId()).isIn(added);
        softly.assertAll();
    }

    @Test
    void createWithForgedCreationDateUsesTheServerTime() throws Exception {
        Map<String, Object> body = adminPageBody("Unidade Com Data Forjada #" + run, NOT_INFORMED);
        body.put("createdAt", "2000-01-01T00:00:00");
        State before = capture();
        LocalDateTime start = LocalDateTime.now();
        MvcResult result = create(body, globalAdmin("bearer"));
        LocalDateTime end = LocalDateTime.now();
        State after = capture();
        Set<Long> added = newUnitIds(before, after);

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        added.forEach(id -> softly.assertThat(withinWindow(after.units().get(id).createdAt(), start, end))
            .as("persisted createdAt %s within request window", after.units().get(id).createdAt()).isTrue());
        softly.assertThat(withinWindow(parseTimestamp(jsonOf(result).get("createdAt")), start, end))
            .as("response createdAt within request window").isTrue();
        softly.assertThat(changes(before, after, added)).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    @Test
    void createWithRelationshipsInTheBodyIgnoresThem() throws Exception {
        Map<String, Object> body = adminPageBody("Unidade Com Relacoes #" + run, NOT_INFORMED);
        body.put("usuarios", List.of(Map.of("id", accounts.get(Actor.INSTRUTOR).getId())));
        body.put("alunos", List.of(Map.of("id", 1)));
        State before = capture();
        MvcResult result = create(body, globalAdmin("bearer"));
        State after = capture();
        Set<Long> added = newUnitIds(before, after);

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        softly.assertThat(changes(before, after, added)).as("relationships and other units").isEmpty();
        softly.assertAll();
    }

    @Test
    void updateWithForgedIdChangesOnlyTheTargetUnit() throws Exception {
        Map<String, Object> body = adminPageBody("A Editada #" + run, OWN_PHONE);
        body.put("id", other.getId());
        State before = capture();
        MvcResult result = update(own, body, globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(responseId(result)).as("response id").isEqualTo(own.getId());
        softly.assertThat(after.units().get(own.getId()).nome()).isEqualTo("A Editada #" + run);
        softly.assertThat(changes(before, after, Set.of(own.getId()))).as("other units and relationships").isEmpty();
        softly.assertAll();
    }

    @Test
    void updateWithForgedCreationDateKeepsTheOriginal() throws Exception {
        Map<String, Object> body = adminPageBody("A Editada #" + run, OWN_PHONE);
        body.put("createdAt", "2000-01-01T00:00:00");
        State before = capture();
        MvcResult result = update(own, body, globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(after.units().get(own.getId()).createdAt()).as("persisted createdAt").isEqualTo(own.getCreatedAt());
        softly.assertThat(changes(before, after, Set.of(own.getId()))).as("other units and relationships").isEmpty();
        softly.assertAll();
    }

    @Test
    void updateWithRelationshipsInTheBodyKeepsTheLinks() throws Exception {
        Map<String, Object> body = adminPageBody("A Editada #" + run, OWN_PHONE);
        body.put("usuarios", List.of());
        body.put("alunos", List.of());
        State before = capture();
        MvcResult result = update(own, body, globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(changes(before, after, Set.of(own.getId()))).as("relationships and other units").isEmpty();
        softly.assertAll();
    }

    // ----- field validation (400, no SQL, nothing persisted) ---------------

    enum Field { NOME, ENDERECO, TELEFONE }

    enum Invalid { EMPTY, BLANK, NULL, OMITTED, TOO_LONG }

    static Stream<Arguments> invalidInputs() {
        return Arrays.stream(Field.values()).flatMap(field ->
            Arrays.stream(Invalid.values()).map(kind -> Arguments.of(field, kind)));
    }

    private static Map<String, Object> withInvalid(Map<String, Object> body, Field field, Invalid kind) {
        String key = field.name().toLowerCase(Locale.ROOT);
        switch (kind) {
            case EMPTY -> body.put(key, "");
            case BLANK -> body.put(key, "   ");
            case NULL -> body.put(key, null);
            case OMITTED -> body.remove(key);
            case TOO_LONG -> body.put(key, "X".repeat(256));
        }
        return body;
    }

    private void assertValidationRejected(MvcResult result, State before) throws Exception {
        State after = capture();
        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(400);
        softly.assertThat(messageOf(result)).as("validation message").isNotBlank();
        // A blank name must be rejected as invalid, never as a duplicate of a leftover row.
        softly.assertThat(messageOf(result)).as("validation message").isNotEqualTo(DUPLICATE_MESSAGE);
        softly.assertThat(sqlLeaks(body(result))).as("SQL details in the response body").isEmpty();
        softly.assertThat(changes(before, after, Set.of())).as("persisted changes").isEmpty();
        softly.assertAll();
    }

    @ParameterizedTest(name = "POST {0} {1}")
    @MethodSource("invalidInputs")
    void invalidCreateIsRejected(Field field, Invalid kind) throws Exception {
        Map<String, Object> body = withInvalid(adminPageBody("Unidade Invalida #" + run, NOT_INFORMED), field, kind);
        State before = capture();
        MvcResult result = create(body, globalAdmin("bearer"));
        assertValidationRejected(result, before);
    }

    @ParameterizedTest(name = "PUT {0} {1}")
    @MethodSource("invalidInputs")
    void invalidUpdateIsRejected(Field field, Invalid kind) throws Exception {
        Map<String, Object> body = withInvalid(adminPageBody("B Invalida #" + run, NOT_INFORMED), field, kind);
        State before = capture();
        MvcResult result = update(other, body, globalAdmin("bearer"));
        assertValidationRejected(result, before);
    }

    private Map<String, Object> bodyAtTheColumnLimit(String namePrefix) {
        String suffix = " #" + run;
        Map<String, Object> body = adminPageBody(namePrefix.repeat(255 - suffix.length()) + suffix, "9".repeat(255));
        body.put("endereco", "E".repeat(255));
        return body;
    }

    @Test
    void createAcceptsValuesAtTheColumnLimit() throws Exception {
        Map<String, Object> body = bodyAtTheColumnLimit("N");
        State before = capture();
        MvcResult result = create(body, globalAdmin("bearer"));
        State after = capture();
        Set<Long> added = newUnitIds(before, after);

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(added).as("exactly one new unit").hasSize(1);
        added.forEach(id -> softly.assertThat(after.units().get(id).nome()).hasSize(255));
        softly.assertAll();
    }

    @Test
    void updateAcceptsValuesAtTheColumnLimit() throws Exception {
        Map<String, Object> body = bodyAtTheColumnLimit("M");
        State before = capture();
        MvcResult result = update(other, body, globalAdmin("bearer"));
        State after = capture();
        UnitRow edited = after.units().get(other.getId());

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(edited).isEqualTo(new UnitRow((String) body.get("nome"), "E".repeat(255), "9".repeat(255), other.getCreatedAt()));
        softly.assertThat(changes(before, after, Set.of(other.getId()))).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    // ----- D3/D4: controlled conflicts, exact-name comparison --------------

    @Test
    void createWithAnExistingNameReturnsTheDuplicateMessage() throws Exception {
        State before = capture();
        MvcResult result = create(adminPageBody(other.getNome(), NOT_INFORMED), globalAdmin("bearer"));
        assertRejectedWithoutChanges(result, 400, DUPLICATE_MESSAGE, before);
    }

    @Test
    void updateToAnotherUnitsNameReturnsControlled400() throws Exception {
        State before = capture();
        MvcResult result = update(empty, adminPageBody(other.getNome(), NOT_INFORMED), globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(400);
        softly.assertThat(messageOf(result)).as("message").isNotBlank();
        softly.assertThat(sqlLeaks(body(result))).as("SQL details in the response body").isEmpty();
        softly.assertThat(changes(before, after, Set.of())).as("persisted changes").isEmpty();
        softly.assertAll();
    }

    @Test
    void updateKeepingItsOwnNameIsAccepted() throws Exception {
        Map<String, Object> body = adminPageBody(other.getNome(), NOT_INFORMED);
        body.put("endereco", "Região atualizada");
        State before = capture();
        MvcResult result = update(other, body, globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(after.units().get(other.getId()).endereco()).isEqualTo("Região atualizada");
        softly.assertThat(changes(before, after, Set.of(other.getId()))).as("other persisted changes").isEmpty();
        softly.assertAll();
    }

    @Test
    void nameComparisonStaysExactAsToday() throws Exception {
        // D4: no case-insensitive rule is introduced.
        State before = capture();
        MvcResult result = create(adminPageBody(other.getNome().toUpperCase(Locale.ROOT), NOT_INFORMED), globalAdmin("bearer"));
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(result.getResponse().getStatus()).as("HTTP status").isEqualTo(200);
        softly.assertThat(newUnitIds(before, after)).as("new units").hasSize(1);
        softly.assertAll();
    }

    // ----- reads remain as they are ----------------------------------------

    @ParameterizedTest(name = "leitura: {0}")
    @EnumSource(Actor.class)
    void readsAreUnchangedForEveryProfile(Actor actor) throws Exception {
        State before = capture();
        MvcResult byId = send(get(path(other)), path(other), null, credential(accounts.get(actor), "bearer"));
        MvcResult list = send(get("/unidades"), "/unidades", null, ANONYMOUS);
        State after = capture();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(byId.getResponse().getStatus()).as("GET by id status").isEqualTo(200);
        softly.assertThat(jsonOf(byId).path("nome").asText(null)).as("GET by id nome").isEqualTo(other.getNome());
        softly.assertThat(list.getResponse().getStatus()).as("public list status").isEqualTo(200);
        softly.assertThat(changes(before, after, Set.of())).as("persisted changes").isEmpty();
        softly.assertAll();
    }
}
