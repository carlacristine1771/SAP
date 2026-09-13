package br.com.sap.controller;

import br.com.sap.dto.atendimento.AtendimentoRequestDTO;
import br.com.sap.dto.atendimento.AtendimentoResponseDTO;
import br.com.sap.dto.atendimento.AtualizarStatusDTO;
import br.com.sap.dto.common.PageResponseDTO;
import br.com.sap.entity.enums.StatusAtendimento;
import br.com.sap.service.AtendimentoService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

    @GetMapping("/paginados")
    public ResponseEntity<PageResponseDTO<AtendimentoResponseDTO>> listarPaginados(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String busca,
            @RequestParam(required = false) StatusAtendimento status
    ) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "dataAtendimento")
        );
        return ResponseEntity.ok(PageResponseDTO.from(
                atendimentoService.listarPaginado(busca, status, pageable)
        ));
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
