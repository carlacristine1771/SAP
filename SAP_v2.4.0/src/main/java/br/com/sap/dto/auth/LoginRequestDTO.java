package br.com.sap.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequestDTO {

    /**
     * Pode receber e-mail ou usuário de login.
     * O cadastro de profissionais do SAP não é feito por CPF.
     */
    @NotBlank(message = "Informe e-mail ou usuário")
    private String email;

    @NotBlank(message = "A senha é obrigatória")
    private String senha;
}
