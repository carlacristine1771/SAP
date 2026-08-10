package br.com.sap.controller;

import br.com.sap.dto.chat.*;
import br.com.sap.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/chat") @RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;
    @GetMapping("/mensagens") public ResponseEntity<List<ChatMensagemDTO>> minhasMensagens(Authentication auth) { return ResponseEntity.ok(chatService.listarMinhasMensagens(auth)); }
    @PostMapping("/mensagens") public ResponseEntity<ChatMensagemDTO> enviar(@RequestBody @Valid ChatMensagemRequestDTO dto, Authentication auth) { return ResponseEntity.ok(chatService.enviar(dto, auth)); }
    @PatchMapping("/mensagens/lidas/{contatoId}") public ResponseEntity<Void> lidas(@PathVariable Long contatoId, Authentication auth) { chatService.marcarComoLidas(contatoId, auth); return ResponseEntity.noContent().build(); }
}
