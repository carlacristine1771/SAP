package br.com.sap.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_mensagens", indexes = {
        @Index(name = "idx_chat_participantes", columnList = "remetente_id,destinatario_id")
})
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMensagem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "remetente_id")
    private Usuario remetente;

    @ManyToOne(optional = false)
    @JoinColumn(name = "destinatario_id")
    private Usuario destinatario;

    @ManyToOne
    @JoinColumn(name = "unidade_id")
    private Unidade unidade;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Column(nullable = false)
    private Boolean lida = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (lida == null) lida = false;
    }
}
