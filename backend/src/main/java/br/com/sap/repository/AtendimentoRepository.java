package br.com.sap.repository;

import br.com.sap.entity.Atendimento;
import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.StatusAtendimento;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
