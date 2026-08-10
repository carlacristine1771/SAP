package br.com.sap.dto.auth;

import br.com.sap.entity.enums.TipoUsuario;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDTO {

    private String token;
    private Long id;
    private String nome;
    private String email;
    private String usuario;
    private TipoUsuario tipoUsuario;
    private Long unidadeId;
    private String unidade;
    private Boolean senhaTemporaria;
}
