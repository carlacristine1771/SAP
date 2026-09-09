package br.com.sap.controller;

import br.com.sap.dto.aluno.AlunoRequestDTO;
import br.com.sap.dto.aluno.AlunoResponseDTO;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import br.com.sap.repository.UsuarioRepository;
import br.com.sap.service.AlunoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/alunos")
@RequiredArgsConstructor
public class AlunoController {

    private final AlunoService alunoService;
    private final UsuarioRepository usuarioRepository;

    @GetMapping
    public ResponseEntity<List<AlunoResponseDTO>> listarTodos(Authentication authentication) {
        Usuario logado = authentication == null ? null : usuarioRepository.findByEmail(authentication.getName()).orElse(null);
        if (logado != null && logado.getTipoUsuario() == TipoUsuario.INSTRUTOR) {
            return ResponseEntity.ok(alunoService.listarPorTurmasDoInstrutor(logado.getId()));
        }
        if (logado != null && (logado.getTipoUsuario() == TipoUsuario.ADMIN_UNIDADE || (logado.getTipoUsuario() == TipoUsuario.ADMINISTRADOR && logado.getUnidade() != null)) && logado.getUnidade() != null) {
            return ResponseEntity.ok(alunoService.listarPorUnidade(logado.getUnidade().getId()));
        }
        return ResponseEntity.ok(alunoService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlunoResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(alunoService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<AlunoResponseDTO> criar(@RequestBody @Valid AlunoRequestDTO dto) {
        return ResponseEntity.ok(alunoService.criar(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AlunoResponseDTO> atualizar(@PathVariable Long id, @RequestBody @Valid AlunoRequestDTO dto) {
        return ResponseEntity.ok(alunoService.atualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        alunoService.deletar(id);
        return ResponseEntity.noContent().build();
    }
}
