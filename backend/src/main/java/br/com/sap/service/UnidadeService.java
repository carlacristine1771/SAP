package br.com.sap.service;

import br.com.sap.dto.unidade.UnidadeRequestDTO;

import br.com.sap.entity.Unidade;
import br.com.sap.entity.Usuario;

import br.com.sap.exception.BusinessRuleException;
import br.com.sap.exception.ResourceNotFoundException;

import br.com.sap.repository.UnidadeRepository;

import br.com.sap.security.UsuarioPermissions;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;

import java.sql.BatchUpdateException;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UnidadeService {

    private static final String NOME_DUPLICADO = "Já existe uma unidade com esse nome";

    private static final String SQLSTATE_UNICIDADE = "23505";

    private static final String TABELA_UNIDADES = "unidades";

    private static final String COLUNA_NOME = "nome";

    private final UnidadeRepository unidadeRepository;

    private final UsuarioPermissions permissions;

    private final Validator validator;

    private final DataSource dataSource;

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

    /*
     * Sempre cria uma entidade nova a partir dos três campos permitidos;
     * id e createdAt são gerados pelo servidor.
     */
    public Unidade criar(UnidadeRequestDTO dto, Authentication authentication) {

        exigirAdministradorGeral(authentication);
        validar(dto);

        if (unidadeRepository.existsByNome(dto.getNome())) {

            throw new BusinessRuleException(NOME_DUPLICADO);
        }

        Unidade unidade = Unidade.builder()
                .nome(dto.getNome())
                .endereco(dto.getEndereco())
                .telefone(dto.getTelefone())
                .build();

        return salvarComNomeUnico(unidade);
    }

    /*
     * Altera somente nome, endereço e telefone; id, createdAt e
     * relacionamentos da unidade existente são preservados.
     */
    public Unidade atualizar(
            Long id,
            UnidadeRequestDTO dto,
            Authentication authentication
    ) {

        exigirAdministradorGeral(authentication);
        validar(dto);

        Unidade unidade = buscarPorId(id);

        if (unidadeRepository.existsByNomeAndIdNot(dto.getNome(), id)) {

            throw new BusinessRuleException(NOME_DUPLICADO);
        }

        unidade.setNome(dto.getNome());
        unidade.setEndereco(dto.getEndereco());
        unidade.setTelefone(dto.getTelefone());

        return salvarComNomeUnico(unidade);
    }

    /*
     * Exclusão desativada para todos os perfis: unidades são referenciadas por
     * usuários, cursos, turmas, alunos, agenda e chat. Nenhuma consulta ou
     * remoção é feita, inclusive para identificadores inexistentes.
     */
    public void deletar(Long id) {

        throw new AccessDeniedException("A exclusão de unidades está desativada.");
    }

    /*
     * Usa o estado atual da conta no banco (ativa, perfil e vínculo), não as
     * claims do token. Administrador geral: ADMINISTRADOR sem unidade.
     */
    private void exigirAdministradorGeral(Authentication authentication) {

        Usuario logado = permissions.authenticated(authentication);

        if (!permissions.isGlobalAdmin(logado)) {
            throw new AccessDeniedException("Somente o administrador geral pode gerenciar unidades.");
        }
    }

    /*
     * Validação feita aqui, depois da autorização, para que perfis sem permissão
     * recebam 403 mesmo com dados inválidos. Mensagens em ordem estável.
     */
    private void validar(UnidadeRequestDTO dto) {

        if (dto == null) {
            throw new BusinessRuleException("Informe os dados da unidade");
        }

        String erros = validator.validate(dto).stream()
                .sorted(Comparator
                        .comparing((ConstraintViolation<UnidadeRequestDTO> v) -> v.getPropertyPath().toString())
                        .thenComparing(ConstraintViolation::getMessage))
                .map(ConstraintViolation::getMessage)
                .distinct()
                .collect(Collectors.joining(" | "));

        if (!erros.isEmpty()) {
            throw new BusinessRuleException(erros);
        }
    }

    /*
     * A verificação prévia de nome não impede uma corrida entre requisições. Se o
     * banco rejeitar a gravação, a classificação usa somente a exceção original:
     * apenas a violação da restrição única de unidades(nome) vira nome duplicado;
     * qualquer outra violação (chave primária, NOT NULL, outras) segue inalterada.
     */
    private Unidade salvarComNomeUnico(Unidade unidade) {

        try {
            return unidadeRepository.saveAndFlush(unidade);
        } catch (DataIntegrityViolationException violacao) {
            if (violouUnicidadeDoNome(violacao)) {
                throw new BusinessRuleException(NOME_DUPLICADO);
            }
            throw violacao;
        }
    }

    private boolean violouUnicidadeDoNome(DataIntegrityViolationException violacao) {

        // Percorre o grafo inteiro: getCause() de todo nó e, em SQLException, também
        // getNextException() (em lotes, o detalhe do servidor pode estar só nas exceções
        // seguintes). A identidade evita ciclos; um nó já visitado (compartilhado, como a
        // PSQLException que o PgJDBC usa como causa e como próxima do lote) é apenas
        // ignorado, e o percurso continua pelos demais pendentes.
        Set<Throwable> visitadas = Collections.newSetFromMap(new IdentityHashMap<>());
        Deque<Throwable> pendentes = new ArrayDeque<>();
        pendentes.add(violacao);
        List<SQLException> errosSql = new ArrayList<>();
        Map<SQLException, Set<String>> restricoesHibernate = new IdentityHashMap<>();
        while (!pendentes.isEmpty()) {
            Throwable no = pendentes.removeFirst();
            if (!visitadas.add(no)) {
                continue;
            }
            if (no.getCause() != null) {
                pendentes.addLast(no.getCause());
            }
            if (no instanceof SQLException sql) {
                errosSql.add(sql);
                if (sql.getNextException() != null) {
                    pendentes.addLast(sql.getNextException());
                }
            }
            if (no instanceof org.hibernate.exception.ConstraintViolationException hibernate
                    && hibernate.getSQLException() != null) {
                restricoesHibernate.computeIfAbsent(hibernate.getSQLException(), erro -> new HashSet<>())
                        .add(hibernate.getConstraintName());
            }
        }

        // Toda SQLException do grafo precisa ser 23505; qualquer outro SQLSTATE (ou nenhum),
        // inclusive no contêiner, torna a cadeia mista e preserva a exceção original.
        // Contêineres (lote com exceções encadeadas) só agrupam e não precisam de detalhes;
        // as demais são violações efetivas e cada uma precisa ser identificada.
        List<SQLException> violacoes = new ArrayList<>();
        for (SQLException erro : errosSql) {
            if (!SQLSTATE_UNICIDADE.equals(erro.getSQLState())) {
                return false;
            }
            if (!conteiner(erro)) {
                violacoes.add(erro);
            }
        }
        if (violacoes.isEmpty()) {
            return false;
        }

        RestricoesDoNome conhecidas = restricoesDoNome();
        if (conhecidas == null) {
            return false;
        }

        if (conhecidas.postgres()) {
            // Campos estruturados do servidor (independentes do idioma): cada violação
            // efetiva precisa informar esquema, tabela e restrição exatos de unidades(nome).
            // Violação sem esses detalhes não é identificável e preserva a original.
            for (SQLException erro : violacoes) {
                Restricao informada = restricaoInformadaPeloPostgres(erro);
                if (informada == null || !conhecidas.restricoes().contains(informada)) {
                    return false;
                }
            }
            return true;
        }

        // H2: o Hibernate extrai "esquema.indice" da mensagem; nomes de índice são únicos
        // por esquema. Cada violação efetiva precisa ter sido convertida pelo Hibernate
        // com um único nome, e esse nome precisa ser o da restrição de unidades(nome).
        Set<String> nomesConhecidos = conhecidas.restricoes().stream()
                .map(restricao -> restricao.esquema() + "." + restricao.nome())
                .collect(Collectors.toSet());
        for (SQLException erro : violacoes) {
            Set<String> informadas = restricoesHibernate.get(erro);
            if (informadas == null || informadas.size() != 1 || !nomesConhecidos.containsAll(informadas)) {
                return false;
            }
        }
        return true;
    }

    /*
     * BatchUpdateException que encadeia outras SQLException (como no PgJDBC) apenas
     * agrupa as falhas do lote. Sem exceções encadeadas, ela própria é a violação, e
     * sem detalhes identificáveis.
     */
    private static boolean conteiner(SQLException erro) {

        return erro instanceof BatchUpdateException
                && (erro.getNextException() != null || erro.getCause() instanceof SQLException);
    }

    /*
     * Lê esquema, tabela e restrição de PSQLException.getServerErrorMessage() por
     * reflexão, pois o driver do PostgreSQL é apenas dependência de execução.
     * Retorna null quando a exceção não traz detalhes do servidor; campos ausentes
     * ficam nulos e, por isso, nunca coincidem com o catálogo.
     */
    private static Restricao restricaoInformadaPeloPostgres(SQLException erroSql) {

        try {
            Object detalhes = erroSql.getClass().getMethod("getServerErrorMessage").invoke(erroSql);
            if (detalhes == null) {
                return null;
            }
            return new Restricao(
                    (String) detalhes.getClass().getMethod("getSchema").invoke(detalhes),
                    (String) detalhes.getClass().getMethod("getTable").invoke(detalhes),
                    (String) detalhes.getClass().getMethod("getConstraint").invoke(detalhes)
            );
        } catch (ReflectiveOperationException | RuntimeException semDetalhes) {
            return null;
        }
    }

    /*
     * Restrições UNIQUE reais (não índices avulsos ou parciais) que cobrem exatamente
     * unidades(nome) na tabela resolvida pela conexão da aplicação, com esquema, tabela
     * e nome. O nome real varia conforme quem criou o banco (script versionado no
     * PostgreSQL, nome gerado nos testes), por isso não é fixado no código. Consulta
     * apenas o catálogo (não dados) e sem cache: a leitura só ocorre quando o banco
     * rejeita uma gravação, e uma restrição renomeada, removida ou recriada depois da
     * inicialização é vista como está no momento da violação. Retorna null quando o
     * banco não é suportado, o catálogo não pode ser lido ou nada inequívoco foi encontrado.
     */
    private RestricoesDoNome restricoesDoNome() {

        try (Connection conexao = dataSource.getConnection()) {
            DatabaseMetaData metadados = conexao.getMetaData();
            String banco = metadados.getDatabaseProductName();
            boolean postgres = "PostgreSQL".equalsIgnoreCase(banco);
            Set<Restricao> encontradas = new HashSet<>();
            if (postgres) {
                try (PreparedStatement consulta = conexao.prepareStatement(RESTRICOES_POSTGRES)) {
                    consulta.setString(1, TABELA_UNIDADES);
                    consulta.setString(2, COLUNA_NOME);
                    lerRestricoes(consulta, encontradas);
                }
            } else if ("H2".equalsIgnoreCase(banco)) {
                boolean maiusculas = metadados.storesUpperCaseIdentifiers();
                try (PreparedStatement consulta = conexao.prepareStatement(RESTRICOES_H2)) {
                    consulta.setString(1, conexao.getSchema());
                    consulta.setString(2, maiusculas ? TABELA_UNIDADES.toUpperCase(Locale.ROOT) : TABELA_UNIDADES);
                    consulta.setString(3, maiusculas ? COLUNA_NOME.toUpperCase(Locale.ROOT) : COLUNA_NOME);
                    lerRestricoes(consulta, encontradas);
                }
            }
            if (encontradas.isEmpty()) {
                return null;
            }
            return new RestricoesDoNome(postgres, Set.copyOf(encontradas));
        } catch (SQLException | RuntimeException indisponivel) {
            return null;
        }
    }

    private static void lerRestricoes(PreparedStatement consulta, Set<Restricao> encontradas) throws SQLException {

        try (ResultSet linhas = consulta.executeQuery()) {
            while (linhas.next()) {
                encontradas.add(new Restricao(linhas.getString(1), linhas.getString(2), linhas.getString(3)));
            }
        }
    }

    /*
     * PostgreSQL: somente contype = 'u' com uma única coluna, "nome", na tabela que
     * o nome não qualificado "unidades" resolve pelo search_path (o mesmo usado
     * pelo Hibernate). Índices únicos avulsos ou parciais não aparecem em pg_constraint.
     *
     * Requisito operacional: todas as conexões do pool precisam resolver "unidades"
     * para o mesmo esquema (search_path definido no usuário, no banco ou na URL, nunca
     * com SET search_path por sessão) e o Hibernate não pode qualificar a tabela com
     * outro esquema (hibernate.default_schema). Se isso divergir, a violação informa
     * um esquema diferente do lido aqui e a exceção original é mantida: perde-se a
     * mensagem amigável, nunca se classifica outra restrição como nome duplicado.
     */
    private static final String RESTRICOES_POSTGRES = """
            select n.nspname, c.relname, con.conname
              from pg_catalog.pg_constraint con
              join pg_catalog.pg_class c on c.oid = con.conrelid
              join pg_catalog.pg_namespace n on n.oid = c.relnamespace
              join pg_catalog.pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
             where con.contype = 'u'
               and con.conrelid = to_regclass(?)
               and cardinality(con.conkey) = 1
               and a.attname = ?
            """;

    /*
     * H2: restrições UNIQUE (não índices avulsos) do esquema da conexão com uma única
     * coluna, "nome". O H2 informa na violação o índice que implementa a restrição.
     */
    private static final String RESTRICOES_H2 = """
            select tc.index_schema, tc.table_name, tc.index_name
              from information_schema.table_constraints tc
              join information_schema.key_column_usage k
                on k.constraint_catalog = tc.constraint_catalog
               and k.constraint_schema = tc.constraint_schema
               and k.constraint_name = tc.constraint_name
             where tc.constraint_type = 'UNIQUE'
               and tc.table_schema = ?
               and tc.table_name = ?
             group by tc.index_schema, tc.table_name, tc.index_name
            having count(*) = 1 and max(k.column_name) = ?
            """;

    /*
     * Nome completo da restrição: esquema, tabela e nome (no H2, o do índice que a
     * implementa).
     */
    private record Restricao(String esquema, String tabela, String nome) {
    }

    private record RestricoesDoNome(boolean postgres, Set<Restricao> restricoes) {
    }
}
