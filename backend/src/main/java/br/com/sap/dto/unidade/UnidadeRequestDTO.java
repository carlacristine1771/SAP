package br.com.sap.dto.unidade;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/*
 * Entrada de cadastro e edição de unidades: somente nome, endereço e telefone.
 * Propriedades extras (id, createdAt, relacionamentos) são ignoradas, nunca
 * vinculadas à entidade. Os limites seguem as colunas varchar(255) do banco.
 * O telefone continua obrigatório; o AdminPage envia "Não informado" quando vazio.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UnidadeRequestDTO {
    @NotBlank(message = "Informe o nome da unidade")
    @Size(max = 255, message = "O nome da unidade deve ter no máximo 255 caracteres")
    private String nome;
    @NotBlank(message = "Informe o endereço da unidade")
    @Size(max = 255, message = "O endereço da unidade deve ter no máximo 255 caracteres")
    private String endereco;
    @NotBlank(message = "Informe o telefone da unidade")
    @Size(max = 255, message = "O telefone da unidade deve ter no máximo 255 caracteres")
    private String telefone;
}
