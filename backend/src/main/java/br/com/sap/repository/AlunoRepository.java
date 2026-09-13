package br.com.sap.repository;

import br.com.sap.entity.Aluno;
import br.com.sap.entity.enums.Turno;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
            select a from Aluno a
            left join a.curso c
            left join a.turma t
            where lower(coalesce(a.nome, '')) like lower(concat('%', :busca, '%'))
               or lower(coalesce(a.cpf, '')) like lower(concat('%', :busca, '%'))
               or lower(coalesce(c.nome, '')) like lower(concat('%', :busca, '%'))
               or lower(coalesce(t.nome, '')) like lower(concat('%', :busca, '%'))
            """)
    Page<Aluno> pesquisar(@Param("busca") String busca, Pageable pageable);

    @Query("""
            select a from Aluno a
            left join a.curso c
            left join a.turma t
            where a.unidade.id = :unidadeId
              and (lower(coalesce(a.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(a.cpf, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(c.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(t.nome, '')) like lower(concat('%', :busca, '%')))
            """)
    Page<Aluno> pesquisarPorUnidade(
            @Param("unidadeId") Long unidadeId,
            @Param("busca") String busca,
            Pageable pageable
    );

    @Query("""
            select a from Aluno a
            left join a.curso c
            left join a.turma t
            where a.turma.instrutor.id = :instrutorId
              and (lower(coalesce(a.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(a.cpf, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(c.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(t.nome, '')) like lower(concat('%', :busca, '%')))
            """)
    Page<Aluno> pesquisarPorInstrutor(
            @Param("instrutorId") Long instrutorId,
            @Param("busca") String busca,
            Pageable pageable
    );
}
