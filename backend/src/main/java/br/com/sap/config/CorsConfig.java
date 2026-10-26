package br.com.sap.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/*
 * Origens com acesso à API (credenciais habilitadas) vêm de sap.cors.allowed-origins
 * (SAP_CORS_ALLOWED_ORIGINS), separadas por vírgula, comparadas exatamente. Sem
 * configuração, apenas o frontend local (Vite em 5173 e preview em 4173). Em produção
 * a variável é obrigatória (application-prod.properties não tem valor padrão).
 * Curingas, caminhos e http fora do loopback são recusados na inicialização.
 */
@Configuration
public class CorsConfig {

    static final String ORIGENS_LOCAIS =
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173";

    private static final Set<String> HOSTS_LOCAIS = Set.of("localhost", "127.0.0.1", "[::1]");

    @Bean
    public CorsFilter corsFilter(@Value("${sap.cors.allowed-origins:" + ORIGENS_LOCAIS + "}") String origens) {

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuracao(origens));

        return new CorsFilter(source);
    }

    static CorsConfiguration configuracao(String origens) {

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowCredentials(true);

        config.setAllowedOrigins(origensPermitidas(origens));

        config.setAllowedHeaders(Arrays.asList(
                "Origin",
                "Content-Type",
                "Accept",
                "Authorization"
        ));

        config.setAllowedMethods(Arrays.asList(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        return config;
    }

    /*
     * Cada origem precisa ser esquema://host[:porta], sem caminho, consulta ou
     * usuário; https, exceto no loopback. Lista vazia significa nenhuma origem externa.
     */
    static List<String> origensPermitidas(String origens) {

        List<String> permitidas = new ArrayList<>();
        for (String origem : (origens == null ? "" : origens).split(",")) {
            String candidata = origem.trim();
            if (candidata.isEmpty()) {
                continue;
            }
            permitidas.add(validarOrigem(candidata));
        }
        return List.copyOf(permitidas);
    }

    private static String validarOrigem(String origem) {

        if (origem.contains("*")) {
            throw new IllegalStateException("Origem CORS com curinga não é permitida: " + origem);
        }
        URI uri;
        try {
            uri = new URI(origem);
        } catch (URISyntaxException invalida) {
            throw new IllegalStateException("Origem CORS inválida: " + origem, invalida);
        }
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean semExtras = uri.getRawUserInfo() == null
                && (uri.getRawPath() == null || uri.getRawPath().isEmpty())
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null;
        if (host.isEmpty() || !semExtras || !(esquema.equals("https") || esquema.equals("http"))) {
            throw new IllegalStateException("Origem CORS deve ser esquema://host[:porta], sem caminho: " + origem);
        }
        if (esquema.equals("http") && !HOSTS_LOCAIS.contains(host)) {
            throw new IllegalStateException("Origem CORS externa precisa usar https: " + origem);
        }
        return origem;
    }
}
