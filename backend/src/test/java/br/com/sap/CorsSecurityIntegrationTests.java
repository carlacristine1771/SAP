package br.com.sap;

import br.com.sap.config.DataInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** CORS through the real security filter chain, with a configured frontend origin. */
@SpringBootTest(properties = {
    "spring.config.location=classpath:/application-auth-isolated.properties",
    "spring.datasource.url=jdbc:h2:mem:cors_security_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "sap.cors.allowed-origins=https://sap-frontend.example.app"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CorsSecurityIntegrationTests {
    static final String FRONTEND = "https://sap-frontend.example.app";

    @MockitoBean DataInitializer dataInitializer;
    @Autowired MockMvc mvc;

    @Test
    void theConfiguredFrontendPassesThePreflightWithCredentials() throws Exception {
        mvc.perform(options("/auth/login")
                .header(HttpHeaders.ORIGIN, FRONTEND)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type,Authorization"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void anotherOriginIsRejectedInThePreflight() throws Exception {
        mvc.perform(options("/auth/login")
                .header(HttpHeaders.ORIGIN, "https://evil.example")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void aCrossOriginRequestFromAnotherOriginIsRejected() throws Exception {
        mvc.perform(get("/unidades").header(HttpHeaders.ORIGIN, "https://evil.example"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void theLocalDevelopmentDefaultIsReplacedByTheConfiguredOrigin() throws Exception {
        mvc.perform(get("/unidades").header(HttpHeaders.ORIGIN, "http://localhost:5173"))
            .andExpect(status().isForbidden());
    }

    @Test
    void theConfiguredFrontendReadsAPublicEndpoint() throws Exception {
        mvc.perform(get("/unidades").header(HttpHeaders.ORIGIN, FRONTEND))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, FRONTEND));
    }

    @Test
    void requestsWithoutOriginAreUnaffected() throws Exception {
        mvc.perform(get("/unidades")).andExpect(status().isOk())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
