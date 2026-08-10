package br.com.sap.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "cursos", uniqueConstraints = @UniqueConstraint(columnNames = {"nome", "unidade_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Curso {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "tipo_aprendizagem")
    private String tipoAprendizagem;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(nullable = false)
    private Boolean ativo = true;

    @ManyToOne
    @JoinColumn(name = "unidade_id", nullable = false)
    private Unidade unidade;

    @JsonIgnore
    @OneToMany(mappedBy = "curso")
    private List<Turma> turmas;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (ativo == null) ativo = true;
    }
}
