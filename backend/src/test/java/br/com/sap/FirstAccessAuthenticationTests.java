package br.com.sap;

import br.com.sap.config.DataInitializer;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.JwtService;
import br.com.sap.security.SecurityConstants;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:first_access_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "jwt.secret=sap_test_secret_key_2026_with_32_chars_minimum",
    "jwt.expiration=86400000"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FirstAccessAuthenticationTests {
    // Never execute the application seed; all accounts below are fictional.
    @MockitoBean DataInitializer dataInitializer;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;

    Usuario first;
    Usuario existing;

    @BeforeEach
    void createFictionalAccounts() {
        first = account("first-access@example.invalid", "first-access-test", true);
        existing = account("existing@example.invalid", "existing-test", false);
    }

    private Usuario account(String email, String username, boolean temporary) {
        Usuario user = users.findByEmail(email).orElseGet(Usuario::new);
        user.setNome("Fictional Test Account");
        user.setEmail(email);
        user.setUsuario(username);
        user.setSenha(encoder.encode("temporary-test"));
        user.setTipoUsuario(TipoUsuario.ADMINISTRADOR);
        user.setAtivo(true);
        user.setSenhaTemporaria(temporary);
        return users.saveAndFlush(user);
    }

    private ResultActions login(String identifier, String password) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", identifier, "senha", password))));
    }

    private JsonNode loginBody(String identifier, String password) throws Exception {
        return json.readTree(login(identifier, password).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder change(String oldPassword, String newPassword) throws Exception {
        return patch("/auth/change-password").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("senhaAtual", oldPassword, "novaSenha", newPassword)));
    }

    @Test
    void firstAccessPasswordChangeLogoutAndNewLogin() throws Exception {
        JsonNode initial = loginBody(first.getUsuario(), "temporary-test");
        assertThat(initial.get("senhaTemporaria").asBoolean()).isTrue();
        String token = initial.get("token").asText();
        // Both accounts deliberately share the same initial password. The bearer
        // must identify the new account even when an older session cookie exists.
        mvc.perform(change("temporary-test", "new-password-test")
            .header("Authorization", "Bearer " + token)
            .cookie(new Cookie(SecurityConstants.AUTH_COOKIE, jwt.generateToken(existing))))
            .andExpect(status().isOk());
        Usuario updated = users.findById(first.getId()).orElseThrow();
        assertThat(updated.getSenhaTemporaria()).isFalse();
        assertThat(updated.getSenha()).isNotEqualTo("new-password-test");
        assertThat(encoder.matches("new-password-test", updated.getSenha())).isTrue();
        assertThat(encoder.matches("temporary-test", users.findById(existing.getId()).orElseThrow().getSenha())).isTrue();
        mvc.perform(post("/auth/logout")).andExpect(status().isNoContent())
            .andExpect(header().stringValues("Set-Cookie", org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("Max-Age=0"))));
        login(first.getUsuario(), "temporary-test").andExpect(status().isUnauthorized());
        JsonNode next = loginBody(first.getEmail(), "new-password-test");
        assertThat(next.get("senhaTemporaria").asBoolean()).isFalse();
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + next.get("token").asText()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first.getId()))
            .andExpect(jsonPath("$.senhaTemporaria").value(false));
    }

    @ParameterizedTest
    @EnumSource(TipoUsuario.class)
    void establishedAccountsStillLoginByEmailAndUsernameAndChangePassword(TipoUsuario role) throws Exception {
        existing.setTipoUsuario(role);
        users.saveAndFlush(existing);
        assertThat(loginBody(existing.getUsuario(), "temporary-test").get("senhaTemporaria").asBoolean()).isFalse();
        JsonNode session = loginBody(existing.getEmail(), "temporary-test");
        mvc.perform(change("temporary-test", "existing-new-test")
            .header("Authorization", "Bearer " + session.get("token").asText()))
            .andExpect(status().isOk());
        assertThat(loginBody(existing.getUsuario(), "existing-new-test").get("senhaTemporaria").asBoolean()).isFalse();
    }

    @Test
    void cookieAuthenticationRemainsSupported() throws Exception {
        mvc.perform(change("temporary-test", "cookie-password-test")
            .cookie(new Cookie(SecurityConstants.AUTH_COOKIE, jwt.generateToken(existing))))
            .andExpect(status().isOk());
    }

    @Test
    void missingInvalidAndExpiredAuthenticationCannotChangePassword() throws Exception {
        String original = first.getSenha();
        mvc.perform(change("temporary-test", "new-password-test")).andExpect(status().isUnauthorized());
        mvc.perform(change("temporary-test", "new-password-test").header("Authorization", "Bearer invalid-test-token"))
            .andExpect(status().isUnauthorized());
        String expired = io.jsonwebtoken.Jwts.builder().setSubject(first.getEmail())
            .setExpiration(new java.util.Date(0))
            .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                "sap_test_secret_key_2026_with_32_chars_minimum".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
            .compact();
        mvc.perform(change("temporary-test", "new-password-test").header("Authorization", "Bearer " + expired))
            .andExpect(status().isUnauthorized());
        assertThat(users.findById(first.getId()).orElseThrow().getSenha()).isEqualTo(original);
    }

    @Test
    void wrongCurrentPasswordAndInvalidNewPasswordDoNotChangeAccount() throws Exception {
        String original = first.getSenha();
        String token = jwt.generateToken(first);
        mvc.perform(change("wrong-test", "new-password-test").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        mvc.perform(change("temporary-test", "short").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        mvc.perform(change("temporary-test", "      ").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        Usuario unchanged = users.findById(first.getId()).orElseThrow();
        assertThat(unchanged.getSenha()).isEqualTo(original);
        assertThat(unchanged.getSenhaTemporaria()).isTrue();
    }

    @Test
    void inactiveAccountCannotUsePreviouslyIssuedToken() throws Exception {
        String token = jwt.generateToken(first);
        first.setAtivo(false);
        users.saveAndFlush(first);
        mvc.perform(change("temporary-test", "new-password-test").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void onlyLoginLogoutAndUnitsArePublic() throws Exception {
        mvc.perform(get("/unidades")).andExpect(status().isOk());
        mvc.perform(post("/auth/logout")).andExpect(status().isNoContent());
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
    }
}
