package br.com.sap.dto.usuario;

import br.com.sap.entity.enums.TipoUsuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioUpdateDTO {

    @NotBlank(message = "O nome é obrigatório")
    private String nome;

    @Email(message = "E-mail inválido")
    @NotBlank(message = "O e-mail é obrigatório")
    private String email;

    private String usuario;

    @Pattern(regexp = "^(?:|(?=[\\s\\S]*\\S)[\\s\\S]{6,})$",
            message = "A nova senha deve ter no mínimo 6 caracteres e não conter apenas espaços")
    private String senha;

    @NotNull(message = "O tipo de usuário é obrigatório")
    private TipoUsuario tipoUsuario;

    private Long unidadeId;
}
