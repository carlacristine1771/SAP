package br.com.sap.controller;

import br.com.sap.dto.turma.*;
import br.com.sap.service.TurmaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/turmas") @RequiredArgsConstructor
public class TurmaController {
    private final TurmaService turmaService;
    @GetMapping public ResponseEntity<List<TurmaDTO>> listar(@RequestParam(required = false) Long unidadeId, Authentication auth) { return ResponseEntity.ok(turmaService.listar(unidadeId, auth)); }
    @GetMapping("/{id}") public ResponseEntity<TurmaDTO> buscar(@PathVariable Long id) { return ResponseEntity.ok(turmaService.buscarPorId(id)); }
    @PostMapping public ResponseEntity<TurmaDTO> criar(@RequestBody @Valid TurmaRequestDTO dto, Authentication auth) { return ResponseEntity.ok(turmaService.criar(dto, auth)); }
    @PutMapping("/{id}") public ResponseEntity<TurmaDTO> atualizar(@PathVariable Long id, @RequestBody @Valid TurmaRequestDTO dto, Authentication auth) { return ResponseEntity.ok(turmaService.atualizar(id, dto, auth)); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> deletar(@PathVariable Long id) { turmaService.deletar(id); return ResponseEntity.noContent().build(); }
}
