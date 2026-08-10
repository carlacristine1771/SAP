package br.com.sap.controller;

import br.com.sap.dto.atendimento.AtendimentoRequestDTO;
import br.com.sap.dto.atendimento.AtendimentoResponseDTO;
import br.com.sap.dto.atendimento.AtualizarStatusDTO;
import br.com.sap.service.AtendimentoService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/atendimentos")
@RequiredArgsConstructor
public class AtendimentoController {

    private final AtendimentoService atendimentoService;

    @GetMapping
    public ResponseEntity<List<AtendimentoResponseDTO>> listarTodos() {

        return ResponseEntity.ok(atendimentoService.listarTodos());
    }

    @PostMapping
    public ResponseEntity<AtendimentoResponseDTO> criar(
            @RequestBody @Valid AtendimentoRequestDTO dto
    ) {

        return ResponseEntity.ok(atendimentoService.criar(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AtendimentoResponseDTO> atualizar(
            @PathVariable Long id,
            @RequestBody @Valid AtendimentoRequestDTO dto
    ) {

        return ResponseEntity.ok(atendimentoService.atualizar(id, dto));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AtendimentoResponseDTO> atualizarStatus(
            @PathVariable Long id,
            @RequestBody @Valid AtualizarStatusDTO dto
    ) {

        return ResponseEntity.ok(
                atendimentoService.atualizarStatus(id, dto)
        );
    }
}