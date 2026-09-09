package br.com.sap.service;

import br.com.sap.entity.Unidade;

import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;

import br.com.sap.repository.UnidadeRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UnidadeService {

    private final UnidadeRepository unidadeRepository;

    public List<Unidade> listarTodas() {

        return unidadeRepository.findAll();
    }

    public Unidade buscarPorId(Long id) {

        return unidadeRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Unidade não encontrada"
                        )
                );
    }

    public Unidade criar(Unidade unidade) {

        if (unidadeRepository.existsByNome(
                unidade.getNome()
        )) {

            throw new BusinessRuleException(
                    "Já existe uma unidade com esse nome"
            );
        }

        return unidadeRepository.save(unidade);
    }

    public Unidade atualizar(
            Long id,
            Unidade unidadeAtualizada
    ) {

        Unidade unidade = buscarPorId(id);

        unidade.setNome(unidadeAtualizada.getNome());
        unidade.setEndereco(unidadeAtualizada.getEndereco());
        unidade.setTelefone(unidadeAtualizada.getTelefone());

        return unidadeRepository.save(unidade);
    }

    public void deletar(Long id) {

        Unidade unidade = buscarPorId(id);

        unidadeRepository.delete(unidade);
    }
}