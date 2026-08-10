package br.com.sap.repository;

import br.com.sap.entity.AgendaEvento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AgendaEventoRepository extends JpaRepository<AgendaEvento, Long> {

    List<AgendaEvento> findAllByOrderByDataInicioAsc();

    List<AgendaEvento> findByPsicologoIdOrderByDataInicioAsc(Long psicologoId);

    List<AgendaEvento> findByUnidadeIdOrderByDataInicioAsc(Long unidadeId);

    List<AgendaEvento> findByDataInicioBetweenOrderByDataInicioAsc(
            LocalDateTime inicio,
            LocalDateTime fim
    );

    List<AgendaEvento> findByPsicologoIdAndDataInicioBetweenOrderByDataInicioAsc(
            Long psicologoId,
            LocalDateTime inicio,
            LocalDateTime fim
    );

    List<AgendaEvento> findByUnidadeIdAndDataInicioBetweenOrderByDataInicioAsc(
            Long unidadeId,
            LocalDateTime inicio,
            LocalDateTime fim
    );
}