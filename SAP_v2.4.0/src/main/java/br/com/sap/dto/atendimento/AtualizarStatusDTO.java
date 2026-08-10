package br.com.sap.dto.atendimento;

import br.com.sap.entity.enums.StatusAtendimento;

import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AtualizarStatusDTO {

    @NotNull(message = "O status é obrigatório")
    private StatusAtendimento status;
}