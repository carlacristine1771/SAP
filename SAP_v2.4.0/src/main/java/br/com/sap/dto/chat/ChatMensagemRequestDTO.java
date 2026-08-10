package br.com.sap.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMensagemRequestDTO {
    @NotNull(message = "O destinatário é obrigatório")
    private Long destinatarioId;
    @NotBlank(message = "A mensagem não pode ser vazia")
    private String texto;
    private Long unidadeId;
}
