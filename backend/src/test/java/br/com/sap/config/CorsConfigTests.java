package br.com.sap.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.filter.CorsFilter;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Allowed CORS origins: exact, configured by environment, safe by default. */
class CorsConfigTests {

    @Test
    void theDefaultAllowsOnlyTheLocalFrontend() {
        CorsConfiguration config = CorsConfig.configuracao(CorsConfig.ORIGENS_LOCAIS);

        assertThat(config.getAllowedOrigins()).containsExactlyInAnyOrder(
            "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173");
        assertThat(config.getAllowedOriginPatterns()).isNullOrEmpty();
        assertThat(config.checkOrigin("http://localhost:5173")).isEqualTo("http://localhost:5173");
        assertThat(config.checkOrigin("https://sap.vercel.app")).isNull();
        assertThat(config.checkOrigin("http://evil.example")).isNull();
    }

    @Test
    void configuredOriginsAreMatchedExactlyWithCredentials() {
        CorsConfiguration config = CorsConfig.configuracao(" https://sap.vercel.app , https://sap.example.com ");

        assertThat(config.getAllowCredentials()).isTrue();
        assertThat(config.checkOrigin("https://sap.vercel.app")).isEqualTo("https://sap.vercel.app");
        assertThat(config.checkOrigin("https://sap.example.com")).isEqualTo("https://sap.example.com");
        assertThat(config.checkOrigin("https://other.vercel.app")).isNull();
        assertThat(config.checkOrigin("https://sap.vercel.app.evil.example")).isNull();
        assertThat(config.checkOrigin("http://sap.vercel.app")).as("scheme matters").isNull();
        assertThat(config.checkOrigin("http://localhost:5173")).as("local default replaced").isNull();
    }

    @Test
    void wildcardsAreRefused() {
        for (String origins : new String[] {"*", "https://*.vercel.app", "https://sap.vercel.app,*"}) {
            assertThatThrownBy(() -> CorsConfig.origensPermitidas(origins))
                .as(origins).isInstanceOf(IllegalStateException.class).hasMessageContaining("curinga");
        }
    }

    @Test
    void pathsUserInfoAndPlainHttpOutsideLoopbackAreRefused() {
        for (String origin : new String[] {
            "https://sap.vercel.app/", "https://sap.vercel.app/login", "https://sap.vercel.app?x=1",
            "https://user@sap.vercel.app", "http://sap.vercel.app", "ftp://sap.vercel.app",
            "sap.vercel.app", "null", "https://"}) {
            assertThatThrownBy(() -> CorsConfig.origensPermitidas(origin))
                .as(origin).isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    void anEmptyListAllowsNoCrossOriginRequest() {
        CorsConfiguration config = CorsConfig.configuracao(" , ");

        assertThat(config.getAllowedOrigins()).isEmpty();
        assertThat(config.checkOrigin("http://localhost:5173")).isNull();
    }

    @Test
    void theProductionProfileRequiresTheVariableWithoutDefault() throws IOException {
        Properties production = new Properties();
        try (Reader reader = Files.newBufferedReader(Path.of("src/main/resources/application-prod.properties"))) {
            production.load(reader);
        }
        assertThat(production.getProperty("sap.cors.allowed-origins")).isEqualTo("${SAP_CORS_ALLOWED_ORIGINS}");
    }

    @Test
    void withoutTheProductionVariableTheApplicationDoesNotStart() {
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withUserConfiguration(CorsConfig.class)
            .withPropertyValues("sap.cors.allowed-origins=${SAP_CORS_ALLOWED_ORIGINS}")
            .run(context -> assertThat(context).hasFailed());

        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withUserConfiguration(CorsConfig.class)
            .withPropertyValues("sap.cors.allowed-origins=${SAP_CORS_ALLOWED_ORIGINS}",
                "SAP_CORS_ALLOWED_ORIGINS=https://sap.vercel.app")
            .run(context -> assertThat(context).hasNotFailed().hasSingleBean(CorsFilter.class));
    }
}
