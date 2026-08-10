package br.com.sap.repository;

import br.com.sap.entity.Curso;
import br.com.sap.entity.Unidade;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CursoRepository extends JpaRepository<Curso, Long> {
    List<Curso> findByAtivoTrueOrderByNomeAsc();
    List<Curso> findByUnidadeAndAtivoTrueOrderByNomeAsc(Unidade unidade);
    boolean existsByNomeIgnoreCaseAndUnidade(String nome, Unidade unidade);
}
