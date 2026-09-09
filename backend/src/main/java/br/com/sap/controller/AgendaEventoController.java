package br.com.sap.controller;

import br.com.sap.dto.agenda.AgendaEventoRequestDTO;
import br.com.sap.dto.agenda.AgendaEventoResponseDTO;
import br.com.sap.service.AgendaEventoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/agenda-eventos")
@RequiredArgsConstructor
public class AgendaEventoController {

    private final AgendaEventoService agendaEventoService;

    @GetMapping
    public ResponseEntity<List<AgendaEventoResponseDTO>> listarTodos() {
        return ResponseEntity.ok(
                agendaEventoService.listarTodos()
        );
    }

    @GetMapping("/periodo")
    public ResponseEntity<List<AgendaEventoResponseDTO>> listarPorPeriodo(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate inicio,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fim
    ) {
        return ResponseEntity.ok(
                agendaEventoService.listarPorPeriodo(inicio, fim)
        );
    }

    @PostMapping
    public ResponseEntity<AgendaEventoResponseDTO> criar(
            @RequestBody @Valid AgendaEventoRequestDTO dto
    ) {
        return ResponseEntity.ok(
                agendaEventoService.criar(dto)
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<AgendaEventoResponseDTO> atualizar(
            @PathVariable Long id,
            @RequestBody @Valid AgendaEventoRequestDTO dto
    ) {
        return ResponseEntity.ok(
                agendaEventoService.atualizar(id, dto)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @PathVariable Long id
    ) {
        agendaEventoService.deletar(id);

        return ResponseEntity.noContent().build();
    }
}