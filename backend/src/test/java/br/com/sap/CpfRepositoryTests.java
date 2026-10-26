package br.com.sap;

import br.com.sap.entity.Aluno;
import br.com.sap.entity.enums.Turno;
import br.com.sap.repository.AlunoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
class CpfRepositoryTests {
    @Autowired
    private AlunoRepository repository;

    @Test
    void comparaCpfLegadoSemMascaraEIgnoraOProprioAluno() {
        verificar("52998224725");
    }

    @Test
    void comparaCpfComMascaraEIgnoraOProprioAluno() {
        verificar("529.982.247-25");
    }

    private void verificar(String cpf) {
        var aluno = repository.saveAndFlush(Aluno.builder()
                .nome("Aluno de teste").cpf(cpf).dataNascimento(LocalDate.of(2007, 5, 10))
                .telefone("0000000000").responsavel("Teste").turno(Turno.MATUTINO).build());
        assertTrue(repository.existsByCpfNormalizadoExcluindoId("52998224725", null));
        assertFalse(repository.existsByCpfNormalizadoExcluindoId("52998224725", aluno.getId()));
        assertTrue(repository.existsByCpfNormalizadoExcluindoId("52998224725", aluno.getId() + 1));
        assertFalse(repository.existsByCpfNormalizadoExcluindoId("52998224724", null));
    }
}
