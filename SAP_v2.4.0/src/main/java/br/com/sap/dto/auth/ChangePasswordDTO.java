package br.com.sap.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChangePasswordDTO {
    @NotBlank(message = "Informe a senha atual")
    private String senhaAtual;
    @NotBlank(message = "Informe a nova senha")
    @Size(min = 6, message = "A nova senha deve ter no mínimo 6 caracteres")
    private String novaSenha;
}
