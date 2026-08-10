package br.com.sap.entity;

import br.com.sap.entity.enums.StatusAtendimento;

import jakarta.persistence.*;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "atendimentos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Atendimento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titulo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @Column(nullable = false)
    private LocalDateTime dataAtendimento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusAtendimento status;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    /**
     * Relatório clínico/pedagógico registrado pela psicóloga após a consulta.
     * Também é anexado ao histórico/observações do aluno para consulta futura.
     */
    @Column(name = "relatorio_consulta", columnDefinition = "TEXT")
    private String relatorioConsulta;

    /**
     * Tipo de atendimento solicitado/definido para o agendamento.
     * Valores usados pelo frontend: dentro, fora e remoto.
     */
    @Column(name = "tipo_atendimento", length = 30)
    private String tipoAtendimento;

    /**
     * Classificação final escolhida pela psicóloga após a consulta.
     * Esse campo alimenta exclusivamente o gráfico de tipos de atendimento.
     */
    @Column(name = "categoria_atendimento", length = 80)
    private String categoriaAtendimento;

    @ManyToOne
    @JoinColumn(name = "aluno_id")
    private Aluno aluno;

    @ManyToOne
    @JoinColumn(name = "psicologo_id")
    private Usuario psicologo;

    @ManyToOne
    @JoinColumn(name = "solicitante_id")
    private Usuario solicitante;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {

        createdAt = LocalDateTime.now();

        if (status == null) {
            status = StatusAtendimento.PENDENTE;
        }
    }
}