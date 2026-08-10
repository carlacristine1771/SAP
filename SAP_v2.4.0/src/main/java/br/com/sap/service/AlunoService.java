package br.com.sap.service;

import br.com.sap.dto.aluno.AlunoRequestDTO;
import br.com.sap.dto.aluno.AlunoResponseDTO;
import br.com.sap.entity.Aluno;
import br.com.sap.entity.Curso;
import br.com.sap.entity.Turma;
import br.com.sap.entity.Unidade;
import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;
import br.com.sap.repository.AlunoRepository;
import br.com.sap.repository.CursoRepository;
import br.com.sap.repository.TurmaRepository;
import br.com.sap.repository.UnidadeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlunoService {

    private final AlunoRepository alunoRepository;
    private final UnidadeRepository unidadeRepository;
    private final CursoRepository cursoRepository;
    private final TurmaRepository turmaRepository;

    public List<AlunoResponseDTO> listarTodos() {
        return alunoRepository.findAll().stream().map(this::converterParaDTO).toList();
    }

    public List<AlunoResponseDTO> listarPorUnidade(Long unidadeId) {
        return alunoRepository.findByUnidadeId(unidadeId).stream().map(this::converterParaDTO).toList();
    }

    public List<AlunoResponseDTO> listarPorTurmasDoInstrutor(Long instrutorId) {
        return alunoRepository.findByTurmaInstrutorId(instrutorId).stream().map(this::converterParaDTO).toList();
    }

    public AlunoResponseDTO buscarPorId(Long id) {
        return converterParaDTO(buscarAluno(id));
    }

    public AlunoResponseDTO criar(AlunoRequestDTO dto) {
        if (alunoRepository.existsByCpf(dto.getCpf())) throw new BusinessRuleException("CPF já cadastrado");
        Aluno aluno = new Aluno();
        aplicarDados(aluno, dto);
        aluno.setAtivo(true);
        alunoRepository.save(aluno);
        return converterParaDTO(aluno);
    }

    public AlunoResponseDTO atualizar(Long id, AlunoRequestDTO dto) {
        Aluno aluno = buscarAluno(id);
        aplicarDados(aluno, dto);
        alunoRepository.save(aluno);
        return converterParaDTO(aluno);
    }

    public void deletar(Long id) {
        Aluno aluno = buscarAluno(id);
        alunoRepository.delete(aluno);
    }

    private void aplicarDados(Aluno aluno, AlunoRequestDTO dto) {
        if (dto.getDataNascimento() != null && dto.getDataNascimento().isAfter(LocalDate.now())) {
            throw new BusinessRuleException("A data de nascimento do aluno não pode ser futura.");
        }

        Unidade unidade = unidadeRepository.findById(dto.getUnidadeId())
                .orElseThrow(() -> new ResourceNotFoundException("Unidade não encontrada"));

        Curso curso = dto.getCursoId() == null ? null : cursoRepository.findById(dto.getCursoId())
                .orElseThrow(() -> new ResourceNotFoundException("Curso não encontrado"));

        Turma turma = dto.getTurmaId() == null ? null : turmaRepository.findById(dto.getTurmaId())
                .orElseThrow(() -> new ResourceNotFoundException("Turma não encontrada"));

        if (turma != null) {
            curso = turma.getCurso();
            unidade = turma.getUnidade();
        }

        aluno.setNome(dto.getNome());
        aluno.setCpf(dto.getCpf());
        aluno.setDataNascimento(dto.getDataNascimento());
        aluno.setTelefone(dto.getTelefone());
        aluno.setEmail(dto.getEmail());
        aluno.setResponsavel(dto.getResponsavel());
        aluno.setTurno(turma != null ? turma.getTurno() : dto.getTurno());
        aluno.setObservacoes(dto.getObservacoes());
        aluno.setUnidade(unidade);
        aluno.setCurso(curso);
        aluno.setTurma(turma);
    }

    private Aluno buscarAluno(Long id) {
        return alunoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Aluno não encontrado"));
    }

    private AlunoResponseDTO converterParaDTO(Aluno aluno) {
        return AlunoResponseDTO.builder()
                .id(aluno.getId())
                .nome(aluno.getNome())
                .cpf(aluno.getCpf())
                .dataNascimento(aluno.getDataNascimento())
                .telefone(aluno.getTelefone())
                .email(aluno.getEmail())
                .responsavel(aluno.getResponsavel())
                .turno(aluno.getTurno())
                .observacoes(aluno.getObservacoes())
                .ativo(aluno.getAtivo())
                .unidadeId(aluno.getUnidade() != null ? aluno.getUnidade().getId() : null)
                .unidade(aluno.getUnidade() != null ? aluno.getUnidade().getNome() : null)
                .cursoId(aluno.getCurso() != null ? aluno.getCurso().getId() : null)
                .curso(aluno.getCurso() != null ? aluno.getCurso().getNome() : null)
                .turmaId(aluno.getTurma() != null ? aluno.getTurma().getId() : null)
                .turma(aluno.getTurma() != null ? aluno.getTurma().getNome() : null)
                .createdAt(aluno.getCreatedAt() != null ? aluno.getCreatedAt().toString() : null)
                .build();
    }
}
