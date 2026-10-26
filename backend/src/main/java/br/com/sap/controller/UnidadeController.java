package br.com.sap.controller;

import br.com.sap.dto.unidade.UnidadeRequestDTO;
import br.com.sap.entity.Unidade;
import br.com.sap.service.UnidadeService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/unidades")
@RequiredArgsConstructor
public class UnidadeController {

    private final UnidadeService unidadeService;

    @GetMapping
    public ResponseEntity<List<Unidade>> listarTodas() {

        return ResponseEntity.ok(
                unidadeService.listarTodas()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<Unidade> buscarPorId(
            @PathVariable Long id
    ) {

        return ResponseEntity.ok(
                unidadeService.buscarPorId(id)
        );
    }

    // Validação do DTO no serviço, após a autorização (403 antes de 400).
    @PostMapping
    public ResponseEntity<Unidade> criar(
            @RequestBody UnidadeRequestDTO dto,
            Authentication authentication
    ) {

        return ResponseEntity.ok(
                unidadeService.criar(dto, authentication)
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<Unidade> atualizar(
            @PathVariable Long id,
            @RequestBody UnidadeRequestDTO dto,
            Authentication authentication
    ) {

        return ResponseEntity.ok(
                unidadeService.atualizar(id, dto, authentication)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @PathVariable Long id
    ) {

        unidadeService.deletar(id);

        return ResponseEntity.noContent().build();
    }
}