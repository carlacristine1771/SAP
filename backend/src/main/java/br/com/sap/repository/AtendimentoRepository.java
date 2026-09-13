package br.com.sap.repository;

import br.com.sap.entity.Atendimento;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.StatusAtendimento;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

public interface AtendimentoRepository
        extends JpaRepository<Atendimento, Long> {

    List<Atendimento> findByStatus(
            StatusAtendimento status
    );

    List<Atendimento> findByPsicologo(
            Usuario psicologo
    );

    List<Atendimento> findByAlunoUnidadeId(Long unidadeId);

    List<Atendimento> findByAlunoTurmaInstrutorId(Long instrutorId);

    @Query("""
            select a from Atendimento a
            left join a.solicitante s
            where (lower(coalesce(a.aluno.nome, '')) like lower(concat('%', :busca, '%'))
               or lower(coalesce(a.descricao, '')) like lower(concat('%', :busca, '%'))
               or lower(coalesce(s.nome, '')) like lower(concat('%', :busca, '%')))
              and (:status is null or a.status = :status)
            """)
    Page<Atendimento> pesquisar(
            @Param("busca") String busca,
            @Param("status") StatusAtendimento status,
            Pageable pageable
    );

    @Query("""
            select a from Atendimento a
            left join a.solicitante s
            where a.aluno.unidade.id = :unidadeId
              and (lower(coalesce(a.aluno.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(a.descricao, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(s.nome, '')) like lower(concat('%', :busca, '%')))
              and (:status is null or a.status = :status)
            """)
    Page<Atendimento> pesquisarPorUnidade(
            @Param("unidadeId") Long unidadeId,
            @Param("busca") String busca,
            @Param("status") StatusAtendimento status,
            Pageable pageable
    );

    @Query("""
            select a from Atendimento a
            left join a.solicitante s
            where a.aluno.turma.instrutor.id = :instrutorId
              and (lower(coalesce(a.aluno.nome, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(a.descricao, '')) like lower(concat('%', :busca, '%'))
                or lower(coalesce(s.nome, '')) like lower(concat('%', :busca, '%')))
              and (:status is null or a.status = :status)
            """)
    Page<Atendimento> pesquisarPorInstrutor(
            @Param("instrutorId") Long instrutorId,
            @Param("busca") String busca,
            @Param("status") StatusAtendimento status,
            Pageable pageable
    );

    Long countByStatus(
            StatusAtendimento status
    );

    Long countByDataAtendimentoBetween(
            LocalDateTime inicio,
            LocalDateTime fim
    );


    @Query("""
            select count(a) > 0
            from Atendimento a
            where a.id <> :idIgnorado
              and a.psicologo = :psicologo
              and a.dataAtendimento = :dataAtendimento
              and a.status = :status
            """)
    boolean existsConflitoHorario(
            @Param("idIgnorado") Long idIgnorado,
            @Param("psicologo") Usuario psicologo,
            @Param("dataAtendimento") LocalDateTime dataAtendimento,
            @Param("status") StatusAtendimento status
    );

    @Query("""
            select count(a) > 0
            from Atendimento a
            where a.psicologo = :psicologo
              and a.dataAtendimento = :dataAtendimento
              and a.status = :status
            """)
    boolean existsConflitoHorarioNovo(
            @Param("psicologo") Usuario psicologo,
            @Param("dataAtendimento") LocalDateTime dataAtendimento,
            @Param("status") StatusAtendimento status
    );
}
