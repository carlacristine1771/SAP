package br.com.sap.repository;

import br.com.sap.entity.ChatMensagem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ChatMensagemRepository extends JpaRepository<ChatMensagem, Long> {
    @Query("""
            select m from ChatMensagem m
            where m.remetente.id = :usuarioId or m.destinatario.id = :usuarioId
            order by m.createdAt asc
            """)
    List<ChatMensagem> findConversasDoUsuario(@Param("usuarioId") Long usuarioId);

    @Modifying
    @Query("update ChatMensagem m set m.lida = true where m.destinatario.id = :usuarioId and m.remetente.id = :contatoId")
    int marcarComoLidas(@Param("usuarioId") Long usuarioId, @Param("contatoId") Long contatoId);
}
