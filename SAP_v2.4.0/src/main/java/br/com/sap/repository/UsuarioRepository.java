package br.com.sap.repository;

import br.com.sap.entity.Usuario;
import br.com.sap.entity.enums.TipoUsuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);

    Optional<Usuario> findByUsuario(String usuario);

    Optional<Usuario> findByEmailIgnoreCaseAndAtivoTrue(String email);

    Optional<Usuario> findByUsuarioIgnoreCaseAndAtivoTrue(String usuario);

    boolean existsByEmail(String email);

    boolean existsByUsuario(String usuario);

    boolean existsByEmailIgnoreCaseAndAtivoTrue(String email);

    boolean existsByUsuarioIgnoreCaseAndAtivoTrue(String usuario);


    List<Usuario> findByTipoUsuario(TipoUsuario tipoUsuario);

    List<Usuario> findByAtivoTrue();

    List<Usuario> findByUnidadeId(Long unidadeId);

    List<Usuario> findByUnidadeIdAndAtivoTrue(Long unidadeId);
}
