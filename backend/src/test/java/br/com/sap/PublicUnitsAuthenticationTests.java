package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.JwtService;
import br.com.sap.security.SecurityConstants;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Regression: the login screen lists units with GET /unidades while the browser
 * may still hold an expired, invalid or restricted token (localStorage Bearer or
 * the SAP_AUTH cookie). The list must stay public without relaxing private APIs.
 * Every request sets the servlet path as the DispatcherServlet does in production.
 */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:public_units_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "jwt.secret=" + PublicUnitsAuthenticationTests.SECRET,
    "jwt.expiration=86400000"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicUnitsAuthenticationTests {
    static final String SECRET = "sap_test_secret_key_2026_with_32_chars_minimum";
    private static final String UNIT_NAME = "Unidade Fictícia Norte";

    // Never execute the application seed; all accounts and units are fictional.
    @MockitoBean DataInitializer dataInitializer;
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @Autowired UnidadeRepository units;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;

    Unidade unit;
    Usuario established;
    Usuario temporary;
    Usuario inactive;

    enum StaleCredential { EXPIRED, MALFORMED, WRONG_SIGNATURE, INACTIVE_ACCOUNT, UNKNOWN_ACCOUNT }

    @BeforeEach
    void createFictionalData() {
        unit = units.findAll().stream().filter(u -> UNIT_NAME.equals(u.getNome())).findFirst()
            .orElseGet(() -> units.saveAndFlush(Unidade.builder()
                .nome(UNIT_NAME).endereco("Endereço fictício").telefone("0000-0000").build()));
        established = account("units-established@example.invalid", "units-established", false, true);
        temporary = account("units-temporary@example.invalid", "units-temporary", true, true);
        inactive = account("units-inactive@example.invalid", "units-inactive", false, false);
    }

    private Usuario account(String email, String username, boolean temporaryPassword, boolean active) {
        Usuario user = users.findByEmail(email).orElseGet(Usuario::new);
        user.setNome("Fictional Test Account");
        user.setEmail(email);
        user.setUsuario(username);
        user.setSenha(encoder.encode("fictional-test"));
        user.setTipoUsuario(TipoUsuario.INSTRUTOR);
        user.setUnidade(unit);
        user.setAtivo(active);
        user.setSenhaTemporaria(temporaryPassword);
        return users.saveAndFlush(user);
    }

    private String token(StaleCredential kind) {
        return switch (kind) {
            case EXPIRED -> Jwts.builder().setSubject(established.getEmail())
                .setIssuedAt(new Date(0)).setExpiration(new Date(1000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
            case MALFORMED -> "invalid-test-token";
            case WRONG_SIGNATURE -> Jwts.builder().setSubject(established.getEmail())
                .setExpiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor("another_fictional_key_with_32_chars_min".getBytes(StandardCharsets.UTF_8)))
                .compact();
            case INACTIVE_ACCOUNT -> jwt.generateToken(inactive);
            case UNKNOWN_ACCOUNT -> {
                Usuario ghost = new Usuario();
                ghost.setEmail("units-ghost@example.invalid");
                ghost.setNome("Fictional Ghost");
                ghost.setTipoUsuario(TipoUsuario.INSTRUTOR);
                yield jwt.generateToken(ghost);
            }
        };
    }

    static Stream<Arguments> staleCredentials() {
        return Arrays.stream(StaleCredential.values())
            .flatMap(kind -> Stream.of(Arguments.of(kind, "bearer"), Arguments.of(kind, "cookie")));
    }

    static Stream<Arguments> transports() {
        return Stream.of(Arguments.of("bearer"), Arguments.of("cookie"));
    }

    /** Servlet path mirrors production, where JwtFilter decides by getServletPath(). */
    private static MockHttpServletRequestBuilder at(MockHttpServletRequestBuilder request, String path) {
        return request.servletPath(path);
    }

    private static MockHttpServletRequestBuilder credential(MockHttpServletRequestBuilder request, String token, String transport) {
        return "bearer".equals(transport) ? request.header("Authorization", "Bearer " + token)
            : request.cookie(new Cookie(SecurityConstants.AUTH_COOKIE, token));
    }

    private static MockHttpServletRequestBuilder unitBody(MockHttpServletRequestBuilder request) {
        return request.contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Unidade Fictícia Nova\",\"endereco\":\"Fictício\",\"telefone\":\"0000-0000\"}");
    }

    @Test
    void anonymousLoginScreenListsUnits() throws Exception {
        mvc.perform(at(get("/unidades"), "/unidades"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].nome", hasItem(UNIT_NAME)))
            .andExpect(jsonPath("$[*].id", hasItem(unit.getId().intValue())));
    }

    @ParameterizedTest(name = "{0} via {1}")
    @MethodSource("staleCredentials")
    void staleCredentialsDoNotBlockThePublicUnitList(StaleCredential kind, String transport) throws Exception {
        mvc.perform(credential(at(get("/unidades"), "/unidades"), token(kind), transport))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].nome", hasItem(UNIT_NAME)));
    }

    @ParameterizedTest(name = "{0} via {1}")
    @MethodSource("staleCredentials")
    void staleCredentialsStillCannotReachPrivateApis(StaleCredential kind, String transport) throws Exception {
        String token = token(kind);
        String byId = "/unidades/" + unit.getId();
        mvc.perform(credential(at(get(byId), byId), token, transport)).andExpect(status().isUnauthorized());
        mvc.perform(credential(unitBody(at(post("/unidades"), "/unidades")), token, transport)).andExpect(status().isUnauthorized());
        mvc.perform(credential(unitBody(at(put(byId), byId)), token, transport)).andExpect(status().isUnauthorized());
        mvc.perform(credential(at(delete(byId), byId), token, transport)).andExpect(status().isUnauthorized());
        mvc.perform(credential(at(get("/cursos"), "/cursos"), token, transport)).andExpect(status().isUnauthorized());
        mvc.perform(credential(at(get("/auth/me"), "/auth/me"), token, transport)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "via {0}")
    @MethodSource("transports")
    void temporaryPasswordSessionStillSeesPublicUnitsButNothingPrivate(String transport) throws Exception {
        String token = jwt.generateToken(temporary);
        String byId = "/unidades/" + unit.getId();
        mvc.perform(credential(at(get("/unidades"), "/unidades"), token, transport))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].nome", hasItem(UNIT_NAME)));
        mvc.perform(credential(at(get(byId), byId), token, transport)).andExpect(status().isForbidden());
        mvc.perform(credential(unitBody(at(post("/unidades"), "/unidades")), token, transport)).andExpect(status().isForbidden());
        mvc.perform(credential(at(get("/cursos"), "/cursos"), token, transport))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Troque a senha temporária antes de acessar o sistema."));
    }

    @ParameterizedTest(name = "via {0}")
    @MethodSource("transports")
    void establishedSessionKeepsUnitAccess(String transport) throws Exception {
        String token = jwt.generateToken(established);
        String byId = "/unidades/" + unit.getId();
        mvc.perform(credential(at(get("/unidades"), "/unidades"), token, transport))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].nome", hasItem(UNIT_NAME)));
        mvc.perform(credential(at(get(byId), byId), token, transport))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nome").value(UNIT_NAME));
    }

    @Test
    void anonymousRequestsToOtherUnitOperationsRemainPrivate() throws Exception {
        String byId = "/unidades/" + unit.getId();
        mvc.perform(at(get(byId), byId)).andExpect(status().isUnauthorized());
        mvc.perform(unitBody(at(post("/unidades"), "/unidades"))).andExpect(status().isUnauthorized());
        mvc.perform(unitBody(at(put(byId), byId))).andExpect(status().isUnauthorized());
        mvc.perform(at(delete(byId), byId)).andExpect(status().isUnauthorized());
        // Trailing slash is a different route in Spring 6 and stays private.
        mvc.perform(get("/unidades/")).andExpect(status().isUnauthorized());
    }
}
