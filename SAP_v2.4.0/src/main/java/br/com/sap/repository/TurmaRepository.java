package br.com.sap.repository;

import br.com.sap.entity.Turma;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.Unidade;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TurmaRepository extends JpaRepository<Turma, Long> {
    List<Turma> findByAtivoTrueOrderByNomeAsc();
    List<Turma> findByUnidadeAndAtivoTrueOrderByNomeAsc(Unidade unidade);
    List<Turma> findByInstrutorAndAtivoTrueOrderByNomeAsc(Usuario instrutor);
    boolean existsByNomeIgnoreCaseAndCursoIdAndUnidade(String nome, Long cursoId, Unidade unidade);
    boolean existsByNomeIgnoreCaseAndUnidadeAndAtivoTrue(String nome, Unidade unidade);
    boolean existsByNomeIgnoreCaseAndUnidadeAndAtivoTrueAndIdNot(String nome, Unidade unidade, Long id);
}
