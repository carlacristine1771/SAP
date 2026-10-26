package br.com.sap;

import org.springframework.beans.factory.config.BeanPostProcessor;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Refuses, before any DDL, every database that is not a freshly initialized, empty and
 * unshared PostgreSQL reached through a loopback address.
 *
 * It post-processes the application's own DataSource bean: Hibernate (create-drop) and
 * every other consumer only receive that bean after the checks pass, so a refused
 * database is never written to. The checks use the effective connection (driver URL
 * and server catalog), not test properties or environment variables: besides the
 * expected database name, the server must have no role other than the connected one,
 * no extension other than plpgsql, no schema other than public, no relation in any
 * user schema and no database other than postgres and the current one. A shared or
 * production server (Supabase included) fails several of these at once.
 */
class DisposablePostgresGuard implements BeanPostProcessor {
    static final String DATABASE = "auth_disposable";

    static final String FINGERPRINT = """
        select current_database(), current_user,
               (select coalesce(string_agg(rolname, ',' order by rolname), '')
                  from pg_catalog.pg_roles where rolname !~ '^pg_'),
               (select coalesce(string_agg(extname, ',' order by extname), '')
                  from pg_catalog.pg_extension),
               (select coalesce(string_agg(datname, ',' order by datname), '')
                  from pg_catalog.pg_database where not datistemplate),
               (select coalesce(string_agg(nspname, ',' order by nspname), '')
                  from pg_catalog.pg_namespace where nspname <> 'information_schema' and nspname !~ '^pg_'),
               (select count(*) from pg_catalog.pg_class c
                  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                 where n.nspname <> 'information_schema' and n.nspname !~ '^pg_')
        """;

    // Single host, IPv4 literal or bracketed IPv6 literal; host names are not resolved.
    static final Pattern URL = Pattern.compile("^jdbc:postgresql://(\\[[0-9a-fA-F:]+]|[0-9.]+)(:\\d+)?/[^,]*$");

    /** What the effective connection reports about the server it reached. */
    record Fingerprint(String product, String url, String database, String user, String roles,
                       String extensions, String databases, String schemas, long relations) {
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof DataSource dataSource) {
            List<String> problems;
            try (Connection connection = dataSource.getConnection()) {
                problems = problems(read(connection));
            } catch (SQLException unreadable) {
                throw new IllegalStateException("Refusing database: it could not be verified", unreadable);
            }
            if (!problems.isEmpty()) {
                throw new IllegalStateException("Refusing database for destructive tests: " + String.join("; ", problems));
            }
        }
        return bean;
    }

    static Fingerprint read(Connection connection) throws SQLException {
        String product = connection.getMetaData().getDatabaseProductName();
        String url = connection.getMetaData().getURL();
        if (!"PostgreSQL".equals(product)) {
            return new Fingerprint(product, url, null, null, null, null, null, null, -1);
        }
        try (Statement statement = connection.createStatement(); ResultSet row = statement.executeQuery(FINGERPRINT)) {
            row.next();
            return new Fingerprint(product, url, row.getString(1), row.getString(2), row.getString(3),
                row.getString(4), row.getString(5), row.getString(6), row.getLong(7));
        }
    }

    static List<String> problems(Fingerprint server) {
        List<String> problems = new ArrayList<>();
        if (!"PostgreSQL".equals(server.product())) {
            problems.add("not PostgreSQL: " + server.product());
            return problems;
        }
        if (!loopback(server.url())) {
            problems.add("connection is not to a single loopback IP address");
        }
        if (!DATABASE.equals(server.database())) {
            problems.add("unexpected database " + server.database());
        }
        if (server.user() == null || !server.user().equals(server.roles())) {
            problems.add("server has roles other than the connected one: " + server.roles());
        }
        if (!"plpgsql".equals(server.extensions())) {
            problems.add("server has extensions other than plpgsql: " + server.extensions());
        }
        if (!Set.of("postgres", DATABASE, DATABASE + ",postgres").contains(String.valueOf(server.databases()))) {
            problems.add("server has other databases: " + server.databases());
        }
        if (!"public".equals(server.schemas())) {
            problems.add("database has schemas other than public: " + server.schemas());
        }
        if (server.relations() != 0) {
            problems.add("database is not empty: " + server.relations() + " relation(s)");
        }
        return problems;
    }

    static boolean loopback(String url) {
        Matcher matcher = URL.matcher(String.valueOf(url));
        if (!matcher.matches()) {
            return false;
        }
        String host = matcher.group(1);
        if (host.startsWith("[")) {
            return host.equals("[::1]") || host.equals("[0:0:0:0:0:0:0:1]");
        }
        String[] octets = host.split("\\.");
        if (octets.length != 4) {
            return false;
        }
        for (String octet : octets) {
            if (octet.isEmpty() || octet.length() > 3 || Integer.parseInt(octet) > 255) {
                return false;
            }
        }
        return octets[0].equals("127");
    }
}
