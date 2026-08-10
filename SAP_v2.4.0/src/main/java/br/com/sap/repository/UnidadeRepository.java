package br.com.sap.repository;

import br.com.sap.entity.Unidade;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UnidadeRepository
        extends JpaRepository<Unidade, Long> {

    boolean existsByNome(String nome);
}