package br.com.sap;

import br.com.sap.repository.AlunoRepository;
import br.com.sap.repository.AtendimentoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@DataJpaTest
@ActiveProfiles("test")
class PaginationRepositoryTests {

    @Autowired
    private AlunoRepository alunoRepository;

    @Autowired
    private AtendimentoRepository atendimentoRepository;

    @Test
    void executaBuscasPaginadasSemAlterarOsEndpointsLegados() {
        PageRequest page = PageRequest.of(0, 20);
        assertDoesNotThrow(() -> alunoRepository.pesquisar("", page));
        assertDoesNotThrow(() -> atendimentoRepository.pesquisar("", null, page));
        assertDoesNotThrow(() -> atendimentoRepository.pesquisarPorInstrutor(1L, "", null, page));
    }
}
