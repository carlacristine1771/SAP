package br.com.sap.service;

import br.com.sap.dto.chat.*;
import br.com.sap.entity.*;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.*;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.util.List;

@Service @RequiredArgsConstructor
public class ChatService {
    private final ChatMensagemRepository mensagemRepository;
    private final UsuarioRepository usuarioRepository;
    private final UnidadeRepository unidadeRepository;
    private final ChatCryptoService chatCryptoService;

    public List<ChatMensagemDTO> listarMinhasMensagens(Authentication auth) {
        Usuario logado = buscarLogado(auth);
        return mensagemRepository.findConversasDoUsuario(logado.getId()).stream().map(this::toDTO).toList();
    }

    public ChatMensagemDTO enviar(ChatMensagemRequestDTO dto, Authentication auth) {
        Usuario remetente = buscarLogado(auth);
        Usuario destinatario = usuarioRepository.findById(dto.getDestinatarioId()).orElseThrow(() -> new ResourceNotFoundException("Destinatário não encontrado"));
        Unidade unidade = dto.getUnidadeId()!=null ? unidadeRepository.findById(dto.getUnidadeId()).orElse(null) : remetente.getUnidade();
        ChatMensagem msg = ChatMensagem.builder()
                .remetente(remetente)
                .destinatario(destinatario)
                .unidade(unidade)
                .texto(chatCryptoService.encrypt(dto.getTexto().trim()))
                .lida(false)
                .build();
        return toDTO(mensagemRepository.save(msg));
    }

    @Transactional
    public void marcarComoLidas(Long contatoId, Authentication auth) {
        Usuario logado = buscarLogado(auth);
        mensagemRepository.marcarComoLidas(logado.getId(), contatoId);
    }

    private Usuario buscarLogado(Authentication auth) {
        if (auth == null) throw new ResourceNotFoundException("Sessão não encontrada");
        return usuarioRepository.findByEmail(auth.getName()).orElseThrow(() -> new ResourceNotFoundException("Usuário logado não encontrado"));
    }

    private ChatMensagemDTO toDTO(ChatMensagem m) {
        return ChatMensagemDTO.builder().id(m.getId()).remetenteId(m.getRemetente().getId()).remetente(m.getRemetente().getNome())
                .destinatarioId(m.getDestinatario().getId()).destinatario(m.getDestinatario().getNome())
                .unidadeId(m.getUnidade()!=null?m.getUnidade().getId():null).texto(chatCryptoService.decrypt(m.getTexto())).lida(m.getLida())
                .createdAt(m.getCreatedAt()!=null?m.getCreatedAt().toString():null).build();
    }
}
