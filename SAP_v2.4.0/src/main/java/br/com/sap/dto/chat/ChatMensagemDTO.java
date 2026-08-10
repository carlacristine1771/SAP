package br.com.sap.dto.chat;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMensagemDTO {
    private Long id;
    private Long remetenteId;
    private String remetente;
    private Long destinatarioId;
    private String destinatario;
    private Long unidadeId;
    private String texto;
    private Boolean lida;
    private String createdAt;
}
