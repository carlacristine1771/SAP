package br.com.sap.repository;

import br.com.sap.entity.Aluno;
import br.com.sap.entity.enums.Turno;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlunoRepository
        extends JpaRepository<Aluno, Long> {

    List<Aluno> findByNomeContainingIgnoreCase(String nome);

    boolean existsByCpf(String cpf);

    List<Aluno> findByTurno(Turno turno);

    Long countByAtivoTrue();

    List<Aluno> findByTurmaInstrutorId(Long instrutorId);

    Long countByCursoIsNull();

    List<Aluno> findByUnidadeId(Long unidadeId);
}