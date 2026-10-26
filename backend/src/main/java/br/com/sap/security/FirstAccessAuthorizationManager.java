package br.com.sap.security;

import br.com.sap.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/** Restricts normal API access using the current database state, never a JWT claim. */
@Component
@RequiredArgsConstructor
public class FirstAccessAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {
    private final UsuarioRepository users;

    @Override
    public AuthorizationDecision check(Supplier<Authentication> authentication, RequestAuthorizationContext context) {
        Authentication current = authentication.get();
        if (current == null || !current.isAuthenticated() || current instanceof AnonymousAuthenticationToken) {
            // Public routes (including GET /unidades) are permitted in SecurityConfig before this manager.
            return new AuthorizationDecision(false);
        }

        return users.findByEmailIgnoreCaseAndAtivoTrue(current.getName())
                .map(user -> {
                    if (Boolean.TRUE.equals(user.getSenhaTemporaria())) {
                        throw new AccessDeniedException("Troque a senha temporária antes de acessar o sistema.");
                    }
                    return new AuthorizationDecision(true);
                })
                .orElseGet(() -> new AuthorizationDecision(false));
    }
}
