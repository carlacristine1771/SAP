package br.com.sap;

import br.com.sap.controller.AuthController;
import br.com.sap.controller.UsuarioController;
import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.exception.GlobalExceptionHandler;
import br.com.sap.repository.UnidadeRepository;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.security.UsuarioPermissions;
import br.com.sap.service.AuthService;
import br.com.sap.service.UsuarioService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** No Spring context, sockets, datasource, configuration files or seed are loaded. */
class UserManagementPermissionsTests {
    enum Profile { GLOBAL, UNIT, LEGACY_UNIT, COORDINATION, INSTRUCTOR, PSYCHOLOGIST, UNIT_WITHOUT_UNIT }
    private final ObjectMapper json = new ObjectMapper();
    private final Map<Long, Usuario> accounts = new LinkedHashMap<>();
    private UsuarioRepository users;
    private PasswordEncoder encoder;
    private MockMvc mvc;
    private AuthService auth;
    private UsuarioService service;
    private Unidade own;
    private Unidade other;

    @BeforeEach
    void isolatedRepositories() {
        users = mock(UsuarioRepository.class);
        UnidadeRepository units = mock(UnidadeRepository.class);
        encoder = mock(PasswordEncoder.class);
        own = Unidade.builder().id(1L).nome("Fictional A").build();
        other = Unidade.builder().id(2L).nome("Fictional B").build();
        when(units.findById(anyLong())).thenAnswer(i -> Optional.of(i.getArgument(0).equals(1L) ? own : other));
        when(users.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(accounts.get(i.getArgument(0))));
        when(users.findByEmailIgnoreCaseAndAtivoTrue(anyString())).thenAnswer(i -> accounts.values().stream()
                .filter(u -> Boolean.TRUE.equals(u.getAtivo()) && u.getEmail().equalsIgnoreCase(i.getArgument(0))).findFirst());
        when(users.findByAtivoTrue()).thenAnswer(i -> accounts.values().stream().filter(Usuario::getAtivo).toList());
        when(users.findByUnidadeIdAndAtivoTrue(anyLong())).thenAnswer(i -> accounts.values().stream()
                .filter(u -> Boolean.TRUE.equals(u.getAtivo()) && u.getUnidade() != null
                        && u.getUnidade().getId().equals(i.getArgument(0))).toList());
        when(users.save(any(Usuario.class))).thenAnswer(i -> {
            Usuario u = i.getArgument(0);
            if (u.getId() == null) u.setId(100L + accounts.size());
            accounts.put(u.getId(), u);
            return u;
        });
        when(encoder.encode(anyString())).thenAnswer(i -> "fictional-hash-" + i.getArgument(0));
        UsuarioPermissions permissions = new UsuarioPermissions(users);
        auth = new AuthService(users, units, encoder, null, null, permissions);
        service = new UsuarioService(users, units, encoder, permissions);
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(auth), new UsuarioController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    private Usuario account(long id, Profile profile, boolean foreign) {
        TipoUsuario role = switch (profile) {
            case GLOBAL, LEGACY_UNIT -> TipoUsuario.ADMINISTRADOR;
            case UNIT, UNIT_WITHOUT_UNIT -> TipoUsuario.ADMIN_UNIDADE;
            case COORDINATION -> TipoUsuario.COORDENACAO;
            case INSTRUCTOR -> TipoUsuario.INSTRUTOR;
            case PSYCHOLOGIST -> TipoUsuario.PSICOLOGO;
        };
        Usuario user = Usuario.builder().id(id).nome("Fictional " + id).email("user" + id + "@example.invalid")
                .usuario("fictional" + id).senha("original-hash").tipoUsuario(role).ativo(true)
                .unidade(profile == Profile.GLOBAL || profile == Profile.UNIT_WITHOUT_UNIT ? null : foreign ? other : own).build();
        accounts.put(id, user);
        return user;
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, Usuario actor) {
        return request.principal(UsernamePasswordAuthenticationToken.authenticated(actor.getEmail(), "unused", List.of()));
    }

    private Map<String, Object> body(TipoUsuario role, Long unit) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("nome", "Fictional updated");
        body.put("email", "updated@example.invalid");
        body.put("usuario", "updated-fictional");
        body.put("senha", "fictional-new-password");
        body.put("tipoUsuario", role);
        body.put("unidadeId", unit);
        return body;
    }

    private String snapshot() throws Exception {
        // Passwords are @JsonIgnore in HTTP responses, so assert them separately too.
        return json.writeValueAsString(accounts) + accounts.values().stream().map(Usuario::getSenha).toList();
    }

    private void forbidden(MockHttpServletRequestBuilder request, Usuario actor) throws Exception {
        String before = snapshot();
        clearInvocations(users, encoder);
        mvc.perform(as(request, actor)).andExpect(status().isForbidden()).andExpect(jsonPath("$.status").value(403));
        assertThat(snapshot()).isEqualTo(before);
        verify(users, never()).save(any());
        verify(encoder, never()).encode(anyString());
    }

    static Stream<Arguments> creationCases() {
        return Arrays.stream(Profile.values()).flatMap(actor -> Arrays.stream(TipoUsuario.values())
                .map(role -> Arguments.of(actor, role)));
    }

    @ParameterizedTest
    @MethodSource("creationCases")
    void creationMatrix(Profile profile, TipoUsuario role) throws Exception {
        Usuario actor = account(1L, profile, false);
        boolean allowed = profile == Profile.GLOBAL || profile == Profile.UNIT || profile == Profile.LEGACY_UNIT
                || (profile == Profile.COORDINATION && role == TipoUsuario.INSTRUTOR);
        MockHttpServletRequestBuilder request = post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(role, 1L)));
        if (allowed) {
            mvc.perform(as(request, actor)).andExpect(status().isOk());
            Usuario created = accounts.values().stream().filter(u -> u.getId() != 1L).findFirst().orElseThrow();
            assertThat(created.getTipoUsuario()).isEqualTo(role == TipoUsuario.ADMIN_UNIDADE ? TipoUsuario.ADMINISTRADOR : role);
            assertThat(created.getUnidade().getId()).isEqualTo(1L);
            assertThat(created.getSenha()).isEqualTo("fictional-hash-fictional-new-password");
            assertThat(created.getSenhaTemporaria()).isTrue();
        } else forbidden(request, actor);
        if (profile != Profile.GLOBAL) {
            for (Long unit : Arrays.asList(2L, null)) forbidden(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body(role, unit))), actor);
        }
    }

    static Stream<Arguments> targetCases() {
        return Arrays.stream(Profile.values()).flatMap(actor -> Arrays.stream(Profile.values())
                .filter(target -> target != Profile.UNIT_WITHOUT_UNIT).map(target -> Arguments.of(actor, target)));
    }

    @ParameterizedTest
    @MethodSource("targetCases")
    void updateMatrixAndPrivilegeEscalations(Profile profile, Profile targetProfile) throws Exception {
        Usuario actor = account(1L, profile, false);
        Usuario target = account(2L, targetProfile, false);
        boolean allowed = profile == Profile.GLOBAL
                || ((profile == Profile.UNIT || profile == Profile.LEGACY_UNIT) && targetProfile != Profile.GLOBAL)
                || (profile == Profile.COORDINATION && targetProfile == Profile.INSTRUCTOR);
        Long unit = targetProfile == Profile.GLOBAL ? null : 1L;
        MockHttpServletRequestBuilder request = put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(target.getTipoUsuario(), unit)));
        if (allowed) {
            mvc.perform(as(request, actor)).andExpect(status().isOk());
            assertThat(target.getSenha()).isEqualTo("fictional-hash-fictional-new-password");
            assertThat(target.getNome()).isEqualTo("Fictional updated");
        } else forbidden(request, actor);
        if (profile != Profile.GLOBAL) {
            for (Long destination : Arrays.asList(2L, null)) forbidden(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body(TipoUsuario.ADMINISTRADOR, destination))), actor);
            if (profile == Profile.COORDINATION) {
                for (TipoUsuario role : TipoUsuario.values()) {
                    if (role != TipoUsuario.INSTRUTOR) forbidden(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(body(role, 1L))), actor);
                }
                forbidden(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body(TipoUsuario.INSTRUTOR, 2L))), actor);
            }
            // Demotion must not let coordination overwrite an administrator, psychologist or coordinator.
            if (profile == Profile.COORDINATION && targetProfile != Profile.INSTRUCTOR) {
                forbidden(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body(TipoUsuario.INSTRUTOR, 1L))), actor);
            }
            target.setUnidade(other);
            forbidden(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body(TipoUsuario.INSTRUTOR, 1L))), actor);
        }
    }

    @ParameterizedTest
    @MethodSource("targetCases")
    void deletionMatrix(Profile profile, Profile targetProfile) throws Exception {
        Usuario actor = account(1L, profile, false);
        Usuario target = account(2L, targetProfile, false);
        boolean allowed = profile == Profile.GLOBAL
                || ((profile == Profile.UNIT || profile == Profile.LEGACY_UNIT) && targetProfile != Profile.GLOBAL);
        if (allowed) {
            mvc.perform(as(delete("/usuarios/2"), actor)).andExpect(status().isNoContent());
            assertThat(target.getAtivo()).isFalse();
        } else forbidden(delete("/usuarios/2"), actor);
        target.setAtivo(true);
        target.setUnidade(other);
        if (profile != Profile.GLOBAL) forbidden(delete("/usuarios/2"), actor);
    }

    @ParameterizedTest
    @EnumSource(Profile.class)
    void directoryReadsKeepPanelsAndGlobalAdminChatWorking(Profile profile) throws Exception {
        Usuario actor = account(1L, profile, false);
        account(2L, Profile.INSTRUCTOR, false);
        account(3L, Profile.PSYCHOLOGIST, true);
        account(4L, Profile.GLOBAL, false);
        mvc.perform(as(get("/usuarios"), actor)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(profile == Profile.UNIT_WITHOUT_UNIT ? 0 : profile == Profile.UNIT || profile == Profile.LEGACY_UNIT ? 2 : 4))
                .andExpect(jsonPath("$[0].senha").doesNotExist());
        mvc.perform(as(get("/usuarios/2"), actor)).andExpect(profile == Profile.UNIT_WITHOUT_UNIT ? status().isForbidden() : status().isOk());
        if (profile == Profile.UNIT || profile == Profile.LEGACY_UNIT || profile == Profile.UNIT_WITHOUT_UNIT) {
            forbidden(get("/usuarios/3"), actor);
            forbidden(get("/usuarios/4"), actor);
        } else {
            mvc.perform(as(get("/usuarios/3"), actor)).andExpect(status().isOk());
            mvc.perform(as(get("/usuarios/4"), actor)).andExpect(status().isOk());
        }
    }

    @ParameterizedTest
    @EnumSource(Profile.class)
    void passwordChangeStillRequiresOwnCurrentPassword(Profile profile) throws Exception {
        Usuario actor = account(1L, profile, false);
        Usuario otherUser = account(2L, Profile.INSTRUCTOR, false);
        when(encoder.matches("correct-fictional", "original-hash")).thenReturn(true);
        mvc.perform(as(patch("/auth/change-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"senhaAtual\":\"wrong-fictional\",\"novaSenha\":\"new-fictional\"}"), actor))
                .andExpect(status().isBadRequest());
        assertThat(actor.getSenha()).isEqualTo("original-hash");
        mvc.perform(as(patch("/auth/change-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"senhaAtual\":\"correct-fictional\",\"novaSenha\":\"new-fictional\",\"id\":2}"), actor))
                .andExpect(status().isOk());
        assertThat(actor.getSenhaTemporaria()).isFalse();
        assertThat(actor.getSenha()).isEqualTo("fictional-hash-new-fictional");
        assertThat(otherUser.getSenha()).isEqualTo("original-hash");
    }

    @Test
    void globalAdminCanCreateGlobalAdminMoveUsersAndChangeProfiles() throws Exception {
        Usuario actor = account(1L, Profile.GLOBAL, false);
        Usuario target = account(2L, Profile.INSTRUCTOR, false);
        Map<String, Object> newAdmin = body(TipoUsuario.ADMINISTRADOR, null);
        newAdmin.put("email", "new-admin@example.invalid");
        newAdmin.put("usuario", "new-admin-fictional");
        mvc.perform(as(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(newAdmin)), actor)).andExpect(status().isOk());
        mvc.perform(as(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(TipoUsuario.PSICOLOGO, 2L))), actor)).andExpect(status().isOk());
        assertThat(target.getUnidade().getId()).isEqualTo(2L);
        assertThat(target.getTipoUsuario()).isEqualTo(TipoUsuario.PSICOLOGO);
    }

    @Test
    void missingAndInactiveActorsCannotBypassPolicyOrReuseInactiveCredentials() throws Exception {
        Usuario inactive = account(1L, Profile.GLOBAL, false);
        inactive.setAtivo(false);
        String before = snapshot();
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(TipoUsuario.ADMINISTRADOR, null)))).andExpect(status().isForbidden());
        forbidden(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(TipoUsuario.ADMINISTRADOR, null))), inactive);
        assertThat(snapshot()).isEqualTo(before);
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> auth.register(br.com.sap.dto.auth.RegisterRequestDTO.builder().build()));
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> service.listarTodos(null));
    }

    @ParameterizedTest
    @EnumSource(value = Profile.class, names = {"COORDINATION", "INSTRUCTOR", "PSYCHOLOGIST"})
    void operationalProfilesCannotRewriteTheirOwnPermissionsOrPasswordThroughManagementApi(Profile profile) throws Exception {
        Usuario actor = account(1L, profile, false);
        for (TipoUsuario role : TipoUsuario.values()) forbidden(put("/usuarios/1").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(role, 1L))), actor);
    }

    @ParameterizedTest
    @EnumSource(value = Profile.class, names = {"GLOBAL", "UNIT", "LEGACY_UNIT", "COORDINATION"})
    void legitimateInstructorEditPreservesPasswordWhenOmittedOrEmpty(Profile profile) throws Exception {
        Usuario actor = account(1L, profile, false);
        Usuario target = account(2L, Profile.INSTRUCTOR, false);
        for (String password : Arrays.asList(null, "")) {
            Map<String, Object> payload = body(TipoUsuario.INSTRUTOR, 1L);
            payload.put("senha", password);
            mvc.perform(as(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(payload)), actor)).andExpect(status().isOk());
            assertThat(target.getSenha()).isEqualTo("original-hash");
            assertThat(target.getTipoUsuario()).isEqualTo(TipoUsuario.INSTRUTOR);
            assertThat(target.getUnidade().getId()).isEqualTo(1L);
        }
        verify(encoder, never()).encode(anyString());
    }

    @ParameterizedTest
    @EnumSource(value = Profile.class, names = {"GLOBAL", "UNIT", "LEGACY_UNIT", "COORDINATION"})
    void legitimateInstructorEditRejectsBlankPasswordWithoutChangingIt(Profile profile) throws Exception {
        Usuario actor = account(1L, profile, false);
        Usuario target = account(2L, Profile.INSTRUCTOR, false);
        Map<String, Object> payload = body(TipoUsuario.INSTRUTOR, 1L);
        payload.put("senha", "   ");
        mvc.perform(as(put("/usuarios/2").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)), actor)).andExpect(status().isBadRequest());
        assertThat(target.getSenha()).isEqualTo("original-hash");
        assertThat(target.getTipoUsuario()).isEqualTo(TipoUsuario.INSTRUTOR);
        assertThat(target.getUnidade().getId()).isEqualTo(1L);
        verify(encoder, never()).encode(anyString());
        verify(users, never()).save(any());
    }

    @Test
    void forbiddenCreationCannotAnonymizeInactiveAccountsWithCollidingCredentials() throws Exception {
        Usuario actor = account(1L, Profile.INSTRUCTOR, false);
        Usuario inactive = account(2L, Profile.INSTRUCTOR, false);
        inactive.setAtivo(false);
        when(users.findByEmail("updated@example.invalid")).thenReturn(Optional.of(inactive));
        when(users.findByUsuario("updated-fictional")).thenReturn(Optional.of(inactive));
        forbidden(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(TipoUsuario.INSTRUTOR, 1L))), actor);
    }

    @Test
    void administratorsCannotDeleteTheirOwnSession() throws Exception {
        Usuario actor = account(1L, Profile.GLOBAL, false);
        mvc.perform(as(delete("/usuarios/1"), actor)).andExpect(status().isBadRequest());
        assertThat(actor.getAtivo()).isTrue();
    }
}
