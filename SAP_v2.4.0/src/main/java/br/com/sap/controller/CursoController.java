package br.com.sap.controller;

import br.com.sap.dto.curso.*;
import br.com.sap.service.CursoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.util.List;

@RestController @RequestMapping("/cursos") @RequiredArgsConstructor
public class CursoController {
    private final CursoService cursoService;
    @GetMapping public ResponseEntity<List<CursoDTO>> listar(@RequestParam(required = false) Long unidadeId, Authentication authentication) { return ResponseEntity.ok(cursoService.listar(unidadeId, authentication)); }
    @GetMapping("/{id}") public ResponseEntity<CursoDTO> buscar(@PathVariable Long id) { return ResponseEntity.ok(cursoService.buscarPorId(id)); }
    @PostMapping public ResponseEntity<CursoDTO> criar(@RequestBody @Valid CursoRequestDTO dto, Authentication authentication) { return ResponseEntity.ok(cursoService.criar(dto, authentication)); }
    @PutMapping("/{id}") public ResponseEntity<CursoDTO> atualizar(@PathVariable Long id, @RequestBody @Valid CursoRequestDTO dto, Authentication authentication) { return ResponseEntity.ok(cursoService.atualizar(id, dto, authentication)); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> deletar(@PathVariable Long id) { cursoService.deletar(id); return ResponseEntity.noContent().build(); }
}
