package br.com.sap.controller;

import br.com.sap.dto.auth.ChangePasswordDTO;
import br.com.sap.dto.auth.LoginRequestDTO;
import br.com.sap.dto.auth.LoginResponseDTO;
import br.com.sap.dto.auth.RegisterRequestDTO;
import br.com.sap.service.AuthService;
import br.com.sap.security.SecurityConstants;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(
            @RequestBody @Valid LoginRequestDTO dto
    ) {
        LoginResponseDTO response = authService.login(dto);

        ResponseCookie authCookie = ResponseCookie.from(SecurityConstants.AUTH_COOKIE, response.getToken())
                .httpOnly(true)
                .path("/")
                .maxAge(24 * 60 * 60)
                .sameSite("Lax")
                .build();

        ResponseCookie sessionCookie = ResponseCookie.from(SecurityConstants.SESSION_COOKIE, encodeCookieValue(buildSessionCookieValue(response)))
                .httpOnly(false)
                .path("/")
                .maxAge(24 * 60 * 60)
                .sameSite("Lax")
                .build();

        // response.setToken(null);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authCookie.toString())
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .body(response);
    }

    @GetMapping("/me")
    public ResponseEntity<LoginResponseDTO> me(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(authService.me(authentication));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        ResponseCookie authCookie = ResponseCookie.from(SecurityConstants.AUTH_COOKIE, "")
                .httpOnly(true)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        ResponseCookie sessionCookie = ResponseCookie.from(SecurityConstants.SESSION_COOKIE, "")
                .httpOnly(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authCookie.toString())
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .build();
    }

    @PatchMapping("/change-password")
    public ResponseEntity<String> changePassword(@RequestBody @Valid ChangePasswordDTO dto, Authentication authentication) {
        authService.changePassword(dto, authentication);
        return ResponseEntity.ok("Senha alterada com sucesso");
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(
            @RequestBody @Valid RegisterRequestDTO dto,
            Authentication authentication
    ) {

        authService.register(dto, authentication);

        return ResponseEntity.ok("Usuário cadastrado com sucesso");
    }
    private String buildSessionCookieValue(LoginResponseDTO response) {
        String role = switch (response.getTipoUsuario()) {
            case ADMINISTRADOR, ADMIN_UNIDADE -> "administrador";
            case PSICOLOGO -> "psicologa";
            case COORDENACAO -> "coordenacao";
            case INSTRUTOR -> "instrutor";
        };

        return "{"
                + "\"id\":\"usr" + response.getId() + "\","
                + "\"apiId\":" + response.getId() + ","
                + "\"role\":\"" + role + "\","
                + "\"nome\":\"" + escapeJson(response.getNome()) + "\","
                + "\"email\":\"" + escapeJson(response.getEmail()) + "\","
                + "\"unidadeId\":\"" + (response.getUnidadeId() == null ? "" : "u" + response.getUnidadeId()) + "\","
                + "\"senhaTemporaria\":" + Boolean.TRUE.equals(response.getSenhaTemporaria()) + ","
                + "\"adminUnidade\":" + isAdminUnidade(response)
                + "}";
    }

    private boolean isAdminUnidade(LoginResponseDTO response) {
        return response.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMIN_UNIDADE
                || (response.getTipoUsuario() == br.com.sap.entity.enums.TipoUsuario.ADMINISTRADOR && response.getUnidadeId() != null);
    }

    private String encodeCookieValue(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

}