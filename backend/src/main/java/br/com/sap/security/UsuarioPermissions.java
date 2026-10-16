package br.com.sap.security;

import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Objects;

/** Shared policy for user administration, using the current active account. */
@Component
@RequiredArgsConstructor
public class UsuarioPermissions {
    private final UsuarioRepository usuarios;

    public Usuario authenticated(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw denied();
        return usuarios.findByEmailIgnoreCaseAndAtivoTrue(authentication.getName()).orElseThrow(this::denied);
    }

    public boolean isGlobalAdmin(Usuario actor) {
        return actor.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && actor.getUnidade() == null;
    }

    public boolean isUnitAdmin(Usuario actor) {
        return actor.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE
                || (actor.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && actor.getUnidade() != null);
    }

    public Long unitId(Usuario user) {
        return user.getUnidade() == null ? null : user.getUnidade().getId();
    }

    private void requireOwnUnit(Usuario actor, Long unit) {
        if (unitId(actor) == null || !Objects.equals(unitId(actor), unit)) throw denied();
    }

    public void requireRead(Usuario actor, Usuario target) {
        // Operational panels retain their existing directory/chat reads.
        if (isUnitAdmin(actor)) requireOwnUnit(actor, unitId(target));
    }

    public void requireCreate(Usuario actor, TipoUsuario role, Long unit) {
        if (isGlobalAdmin(actor)) return;
        if (!isUnitAdmin(actor)
                && !(actor.getTipoUsuario() == TipoUsuario.COORDENACAO && role == TipoUsuario.INSTRUTOR)) {
            throw denied();
        }
        requireOwnUnit(actor, unit);
    }

    public void requireUpdate(Usuario actor, Usuario target, TipoUsuario role, Long unit) {
        requireCreate(actor, role, unit);
        if (!isGlobalAdmin(actor)) requireOwnUnit(actor, unitId(target));
        // Coordination may edit instructors, including the password field already
        // exposed in its panel, but may never convert another profile to instructor.
        if (!isGlobalAdmin(actor) && !isUnitAdmin(actor) && target.getTipoUsuario() != TipoUsuario.INSTRUTOR) {
            throw denied();
        }
    }

    public void requireDelete(Usuario actor, Usuario target) {
        if (isGlobalAdmin(actor)) return;
        if (!isUnitAdmin(actor)) throw denied();
        requireRead(actor, target);
    }

    private AccessDeniedException denied() {
        return new AccessDeniedException("Sem permissão para gerenciar este usuário ou unidade.");
    }
}
