package br.com.sap.controller;

import br.com.sap.dto.usuario.UsuarioUpdateDTO;
import br.com.sap.entity.Usuario;
import br.com.sap.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

import java.util.List;

@RestController
@RequestMapping("/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    @GetMapping
    public ResponseEntity<List<Usuario>> listarTodos(Authentication authentication) {
        return ResponseEntity.ok(usuarioService.listarTodos(authentication));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.buscarPorId(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Usuario> atualizar(@PathVariable Long id, @RequestBody @Valid UsuarioUpdateDTO dto, Authentication authentication) {
        return ResponseEntity.ok(usuarioService.atualizar(id, dto, authentication));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id, Authentication authentication) {
        usuarioService.deletar(id, authentication);
        return ResponseEntity.noContent().build();
    }
}
