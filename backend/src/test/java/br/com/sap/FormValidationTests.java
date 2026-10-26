package br.com.sap;

import br.com.sap.dto.aluno.AlunoRequestDTO;
import br.com.sap.dto.usuario.UsuarioUpdateDTO;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FormValidationTests {
    @Test
    void validaCpfComESemMascaraERejeitaDigitosInvalidos() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (String cpf : new String[]{"52998224725", "529.982.247-25"}) {
                assertTrue(validator.validateValue(AlunoRequestDTO.class, "cpf", cpf).isEmpty());
            }
            for (String cpf : new String[]{"", "11111111111", "00000000000", "52998224724", "52998224715"}) {
                assertEquals(false, validator.validateValue(AlunoRequestDTO.class, "cpf", cpf).isEmpty());
            }
        }
    }

    @Test
    void validaEmailESenhaOpcionalNaEdicao() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertTrue(validator.validateValue(UsuarioUpdateDTO.class, "email", "teste@gmail.com").isEmpty());
            assertEquals(false, validator.validateValue(UsuarioUpdateDTO.class, "email", "teste@").isEmpty());
            for (String senha : new String[]{null, "", "senha de teste"}) {
                assertTrue(validator.validateValue(UsuarioUpdateDTO.class, "senha", senha).isEmpty());
            }
            for (String senha : new String[]{"a", "12345", "      "}) {
                assertEquals(false, validator.validateValue(UsuarioUpdateDTO.class, "senha", senha).isEmpty());
            }
        }
    }
}
