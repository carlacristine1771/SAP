package br.com.sap.controller;

import br.com.sap.entity.Unidade;
import br.com.sap.service.UnidadeService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
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

    @PostMapping
    public ResponseEntity<Unidade> criar(
            @RequestBody @Valid Unidade unidade
    ) {

        return ResponseEntity.ok(
                unidadeService.criar(unidade)
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<Unidade> atualizar(
            @PathVariable Long id,
            @RequestBody @Valid Unidade unidade
    ) {

        return ResponseEntity.ok(
                unidadeService.atualizar(id, unidade)
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