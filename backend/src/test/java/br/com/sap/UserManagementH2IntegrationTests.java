package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.*;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.*;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real security filters, transactions and H2; no application config or seed. */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:p0_integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"
})
@AutoConfigureMockMvc
class UserManagementH2IntegrationTests {
    enum Profile { GLOBAL, UNIT, COORDINATION, INSTRUCTOR, PSYCHOLOGIST, LEGACY_UNIT }
    @MockitoBean DataInitializer seed;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository users;
    @Autowired UnidadeRepository units;
    @Autowired CursoRepository courses;
    @Autowired TurmaRepository classes;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    final Map<Profile, Usuario> actors = new EnumMap<>(Profile.class);
    Unidade own, other;
    Usuario target, foreign, inactive;
    String suffix;

    @BeforeEach void fixtures() {
        suffix = UUID.randomUUID().toString();
        own = unit("A"); other = unit("B");
        for (Profile profile : Profile.values()) {
            TipoUsuario role = switch (profile) {
                case GLOBAL, LEGACY_UNIT -> TipoUsuario.ADMINISTRADOR;
                case UNIT -> TipoUsuario.ADMIN_UNIDADE;
                case COORDINATION -> TipoUsuario.COORDENACAO;
                case INSTRUCTOR -> TipoUsuario.INSTRUTOR;
                case PSYCHOLOGIST -> TipoUsuario.PSICOLOGO;
            };
            actors.put(profile, account(profile.name(), role, profile == Profile.GLOBAL ? null : own));
        }
        target = account("target", TipoUsuario.INSTRUTOR, own);
        foreign = account("foreign", TipoUsuario.INSTRUTOR, other);
        inactive = account("inactive", TipoUsuario.INSTRUTOR, own);
        inactive.setAtivo(false); users.saveAndFlush(inactive);
    }
    Unidade unit(String name) {
        return units.saveAndFlush(Unidade.builder().nome("Fictional " + name + suffix)
            .endereco("Fictional Street").telefone("00000000000").build());
    }
    Usuario account(String name, TipoUsuario role, Unidade unit) {
        return users.saveAndFlush(Usuario.builder().nome("Fictional " + name)
            .email(name + suffix + "@example.invalid").usuario(name + suffix)
            .senha(encoder.encode("fictional-password")).tipoUsuario(role).unidade(unit)
            .senhaTemporaria(false).ativo(true).build());
    }
    String login(Profile profile) throws Exception {
        return json.readTree(mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", actors.get(profile).getUsuario(), "senha", "fictional-password"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }
    Map<String, Object> body(TipoUsuario role, Long unit, String password) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("nome", "Fictional Edited"); value.put("email", "new" + suffix + "@example.invalid");
        value.put("usuario", "new" + suffix); value.put("senha", password);
        value.put("tipoUsuario", role); value.put("unidadeId", unit);
        return value;
    }
    MockHttpServletRequestBuilder payload(MockHttpServletRequestBuilder request, Map<String, Object> value) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(value));
    }
    ResultActions perform(MockHttpServletRequestBuilder request, String token) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token));
    }
    // Snapshot every column of every application table through a separate JDBC read.
    // Test methods are deliberately not @Transactional, so service commits are visible.
    Map<String, Object> database() {
        Map<String, Object> state = new TreeMap<>();
        jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'", String.class)
            .forEach(table -> state.put(table, jdbc.queryForList("SELECT * FROM \"" + table + "\" ORDER BY id")));
        assertThat(state).containsKeys("usuarios", "unidades");
        return state;
    }
    void denied(MockHttpServletRequestBuilder request, String token) throws Exception {
        Map<String, Object> before = database();
        perform(request, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.status").value(403));
        assertThat(database()).isEqualTo(before);
    }

    @ParameterizedTest @EnumSource(Profile.class)
    void directoryContactsAndChatRemainUsable(Profile profile) throws Exception {
        String token = login(profile);
        JsonNode directory = json.readTree(perform(get("/usuarios"), token).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        List<Long> ids = new ArrayList<>(); directory.forEach(u -> {
            ids.add(u.get("id").asLong()); assertThat(u.has("senha")).isFalse();
        });
        assertThat(ids).contains(target.getId()).doesNotContain(inactive.getId());
        if (profile == Profile.UNIT || profile == Profile.LEGACY_UNIT) {
            assertThat(ids).doesNotContain(foreign.getId(), actors.get(Profile.GLOBAL).getId());
            denied(get("/usuarios/" + foreign.getId()), token);
        } else assertThat(ids).contains(foreign.getId(), actors.get(Profile.GLOBAL).getId());
        String text = "Fictional message " + suffix;
        perform(payload(post("/chat/mensagens"), new LinkedHashMap<>(Map.of("destinatarioId", target.getId(),
            "texto", text, "unidadeId", own.getId()))), token).andExpect(status().isOk()).andExpect(jsonPath("$.texto").value(text));
        perform(get("/chat/mensagens"), token).andExpect(status().isOk()).andExpect(jsonPath("$[0].texto").value(text));
        perform(patch("/chat/mensagens/lidas/" + actors.get(profile).getId()), loginFor(target)).andExpect(status().isNoContent());
        perform(get("/chat/mensagens"), token).andExpect(jsonPath("$[0].lida").value(true));
    }
    String loginFor(Usuario user) throws Exception {
        return json.readTree(mvc.perform(payload(post("/auth/login"), new LinkedHashMap<>(Map.of("email", user.getEmail(), "senha", "fictional-password"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    @ParameterizedTest @EnumSource(Profile.class)
    void creationAndEditingFollowActualDatabasePolicy(Profile profile) throws Exception {
        String token = login(profile);
        var create = payload(post("/auth/register"), body(TipoUsuario.INSTRUTOR, own.getId(), "created-password"));
        var update = payload(put("/usuarios/" + target.getId()), body(TipoUsuario.INSTRUTOR, own.getId(), null));
        if (profile == Profile.INSTRUCTOR || profile == Profile.PSYCHOLOGIST) {
            denied(create, token); denied(update, token); denied(delete("/usuarios/" + target.getId()), token);
        } else {
            perform(create, token).andExpect(status().isOk());
            Usuario created = users.findByEmail("new" + suffix + "@example.invalid").orElseThrow();
            assertThat(created.getSenhaTemporaria()).isTrue();
            assertThat(encoder.matches("created-password", created.getSenha())).isTrue();
            // Use unique credentials for the edit, just as the coordination panel does.
            suffix += "edit";
            String hash = users.findById(target.getId()).orElseThrow().getSenha();
            perform(payload(put("/usuarios/" + target.getId()), body(TipoUsuario.INSTRUTOR, own.getId(), null)), token).andExpect(status().isOk());
            assertThat(users.findById(target.getId()).orElseThrow().getSenha()).isEqualTo(hash);
            perform(payload(put("/usuarios/" + target.getId()), body(TipoUsuario.INSTRUTOR, own.getId(), "reset-password")), token).andExpect(status().isOk());
            assertThat(encoder.matches("reset-password", users.findById(target.getId()).orElseThrow().getSenha())).isTrue();
            if (profile == Profile.COORDINATION) denied(delete("/usuarios/" + target.getId()), token);
            else {
                perform(delete("/usuarios/" + target.getId()), token).andExpect(status().isNoContent());
                assertThat(users.findById(target.getId()).orElseThrow().getAtivo()).isFalse();
            }
        }
    }

    @ParameterizedTest @EnumSource(value = Profile.class, names = "GLOBAL", mode = EnumSource.Mode.EXCLUDE)
    void forbiddenWritesDoNotChangeAnyTableOrInactiveCredentials(Profile profile) throws Exception {
        String token = login(profile);
        var collision = body(TipoUsuario.ADMINISTRADOR, other.getId(), "forbidden-password");
        collision.put("email", inactive.getEmail()); collision.put("usuario", inactive.getUsuario());
        denied(payload(post("/auth/register"), collision), token);
        denied(payload(put("/usuarios/" + foreign.getId()), collision), token);
        denied(delete("/usuarios/" + foreign.getId()), token);
        if (profile == Profile.COORDINATION || profile == Profile.INSTRUCTOR || profile == Profile.PSYCHOLOGIST) {
            denied(payload(put("/usuarios/" + target.getId()), body(TipoUsuario.ADMINISTRADOR, own.getId(), "forbidden-password")), token);
            denied(payload(put("/usuarios/" + actors.get(Profile.PSYCHOLOGIST).getId()), body(TipoUsuario.INSTRUTOR, own.getId(), "forbidden-password")), token);
        }
    }

    @Test void unauthenticatedWritesAre401AndDoNotChangeDatabase() throws Exception {
        var before = database();
        mvc.perform(payload(post("/auth/register"), body(TipoUsuario.ADMINISTRADOR, null, "fictional-password"))).andExpect(status().isUnauthorized());
        mvc.perform(payload(put("/usuarios/" + target.getId()), body(TipoUsuario.INSTRUTOR, own.getId(), null))).andExpect(status().isUnauthorized());
        mvc.perform(delete("/usuarios/" + target.getId())).andExpect(status().isUnauthorized());
        assertThat(database()).isEqualTo(before);
    }

    Curso course(Unidade unit) {
        return courses.saveAndFlush(Curso.builder().nome("Fictional course " + suffix).unidade(unit).build());
    }

    Map<String, Object> classBody(Curso course, Usuario instructor) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("nome", "Fictional class " + suffix);
        value.put("turno", "MATUTINO"); value.put("cursoId", course.getId());
        value.put("unidadeId", course.getUnidade().getId());
        value.put("instrutorId", instructor == null ? null : instructor.getId());
        return value;
    }

    Turma classroom(Curso course) {
        return classes.saveAndFlush(Turma.builder().nome("Fictional original " + suffix)
            .turno(br.com.sap.entity.enums.Turno.MATUTINO).curso(course)
            .unidade(course.getUnidade()).instrutor(target).build());
    }

    @Test void coordinationCannotForgeInstructorOrMoveClassAcrossUnits() throws Exception {
        String token = login(Profile.COORDINATION);
        Curso localCourse = course(own), foreignCourse = course(other);
        Turma localClass = classroom(localCourse), foreignClass = classroom(foreignCourse);
        Usuario withoutUnit = account("no-unit", TipoUsuario.INSTRUTOR, null);
        for (Usuario invalid : List.of(foreign, inactive, withoutUnit, actors.get(Profile.PSYCHOLOGIST))) {
            denied(payload(post("/turmas"), classBody(localCourse, invalid)), token);
            denied(payload(put("/turmas/" + localClass.getId()), classBody(localCourse, invalid)), token);
        }
        // Forging all three IDs together must not bypass instructor/unit validation.
        denied(payload(post("/turmas"), classBody(foreignCourse, foreign)), token);
        denied(payload(put("/turmas/" + localClass.getId()), classBody(foreignCourse, foreign)), token);
        denied(payload(put("/turmas/" + foreignClass.getId()), classBody(localCourse, target)), token);
    }

    @Test void coordinationWithoutUnitCannotAssignAnInstructor() throws Exception {
        Usuario coordinator = actors.get(Profile.COORDINATION);
        coordinator.setUnidade(null); users.saveAndFlush(coordinator);
        Curso localCourse = course(own);
        Turma localClass = classroom(localCourse);
        String token = login(Profile.COORDINATION);
        denied(payload(post("/turmas"), classBody(localCourse, target)), token);
        denied(payload(put("/turmas/" + localClass.getId()), classBody(localCourse, target)), token);
    }

    @ParameterizedTest @EnumSource(value = Profile.class, names = {"COORDINATION", "GLOBAL"})
    void authorizedClassCreationEditingAndUnassignmentArePersisted(Profile profile) throws Exception {
        String token = login(profile);
        // General administrators keep the ability to manage either unit.
        Curso selectedCourse = course(profile == Profile.GLOBAL ? other : own);
        Usuario instructor = profile == Profile.GLOBAL ? foreign : target;
        long id = json.readTree(perform(payload(post("/turmas"), classBody(selectedCourse, instructor)), token)
            .andExpect(status().isOk()).andExpect(jsonPath("$.instrutorId").value(instructor.getId()))
            .andReturn().getResponse().getContentAsString()).get("id").asLong();
        assertThat(jdbc.queryForObject("SELECT instrutor_id FROM turmas WHERE id=?", Long.class, id)).isEqualTo(instructor.getId());
        perform(payload(put("/turmas/" + id), classBody(selectedCourse, null)), token).andExpect(status().isOk());
        assertThat(jdbc.queryForMap("SELECT instrutor_id FROM turmas WHERE id=?", id).get("instrutor_id")).isNull();
        perform(payload(put("/turmas/" + id), classBody(selectedCourse, instructor)), token).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT instrutor_id FROM turmas WHERE id=?", Long.class, id)).isEqualTo(instructor.getId());
    }
}
