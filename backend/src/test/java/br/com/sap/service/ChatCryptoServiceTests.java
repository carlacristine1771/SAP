package br.com.sap.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.env.MockEnvironment;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chat encryption key: mandatory in prod, no known public fallback, invalid values
 * stop the startup, and the key derivation stays compatible with stored messages.
 * All secrets here are fictional.
 */
class ChatCryptoServiceTests {
    static final String SECRET = "fictional-chat-secret-for-tests-2026";

    static MockEnvironment environment(String... profiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        return environment;
    }

    ApplicationContextRunner prodContext() {
        return new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
            .withBean(ChatCryptoService.class);
    }

    // ----- prod requires a real secret ----------------------------------------------

    @Test
    void inProdWithoutTheVariableTheApplicationDoesNotStart() {
        prodContext()
            .withPropertyValues("sap.chat.secret=${SAP_CHAT_SECRET}")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void inProdThePublicDefaultIsNeverUsedAsAFallback() {
        prodContext().run(context -> assertThat(context).hasFailed());
    }

    @Test
    void inProdAnEmptyOrBlankSecretIsRejected() {
        for (String blank : new String[] {"", "   ", "\t"}) {
            assertThatThrownBy(() -> new ChatCryptoService(blank, environment("prod")))
                .as("[" + blank + "]").isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SAP_CHAT_SECRET");
        }
        prodContext()
            .withPropertyValues("sap.chat.secret=${SAP_CHAT_SECRET}", "SAP_CHAT_SECRET=")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void inProdTheOldPublicDefaultIsRejectedWithoutRevealingIt() {
        for (String old : new String[] {ChatCryptoService.CHAVE_PADRAO_PUBLICA,
            " " + ChatCryptoService.CHAVE_PADRAO_PUBLICA + " "}) {
            assertThatThrownBy(() -> new ChatCryptoService(old, environment("prod")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SAP_CHAT_SECRET")
                .hasMessageNotContaining(ChatCryptoService.CHAVE_PADRAO_PUBLICA);
        }
        prodContext()
            .withPropertyValues("sap.chat.secret=" + ChatCryptoService.CHAVE_PADRAO_PUBLICA)
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void inProdAValidSecretStartsAndEncrypts() {
        prodContext()
            .withPropertyValues("sap.chat.secret=${SAP_CHAT_SECRET}", "SAP_CHAT_SECRET=" + SECRET)
            .run(context -> {
                assertThat(context).hasNotFailed();
                ChatCryptoService service = context.getBean(ChatCryptoService.class);
                String stored = service.encrypt("mensagem ficticia");
                assertThat(stored).startsWith("ENC:v1:").doesNotContain("mensagem ficticia");
                assertThat(service.decrypt(stored)).isEqualTo("mensagem ficticia");
            });
    }

    @Test
    void theProductionProfileRequiresTheVariableWithoutDefault() throws IOException {
        Properties production = new Properties();
        try (Reader reader = Files.newBufferedReader(Path.of("src/main/resources/application-prod.properties"))) {
            production.load(reader);
        }
        assertThat(production.getProperty("sap.chat.secret")).isEqualTo("${SAP_CHAT_SECRET}");
    }

    @Test
    void outsideProdTheDevelopmentDefaultStillWorks() {
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withBean(ChatCryptoService.class)
            .run(context -> {
                assertThat(context).hasNotFailed();
                ChatCryptoService service = context.getBean(ChatCryptoService.class);
                assertThat(service.decrypt(service.encrypt("ola"))).isEqualTo("ola");
            });
    }

    // ----- compatibility with stored messages ---------------------------------------

    /** Encrypts as messages were stored before this change: AES-GCM, key = SHA-256 of the secret. */
    static String storedBefore(String secret, String text) throws Exception {
        byte[] key = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        byte[] iv = new byte[12];
        for (int i = 0; i < iv.length; i++) iv[i] = (byte) (i + 1);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] encrypted = cipher.doFinal(text.getBytes(StandardCharsets.UTF_8));
        return "ENC:v1:" + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(encrypted);
    }

    @Test
    void messagesStoredWithTheSameSecretRemainReadableInProd() throws Exception {
        String stored = storedBefore(SECRET, "mensagem antiga");

        assertThat(new ChatCryptoService(SECRET, environment("prod")).decrypt(stored)).isEqualTo("mensagem antiga");
    }

    @Test
    void theSameSecretReadsAcrossProfiles() {
        String stored = new ChatCryptoService(SECRET, environment()).encrypt("entre perfis");

        assertThat(new ChatCryptoService(SECRET, environment("prod")).decrypt(stored)).isEqualTo("entre perfis");
    }

    @Test
    void anotherSecretCannotReadAStoredMessage() throws Exception {
        String stored = storedBefore(SECRET, "mensagem antiga");

        String result = new ChatCryptoService("another-fictional-secret-2026", environment("prod")).decrypt(stored);

        assertThat(result).isEqualTo("[mensagem criptografada indisponível]").doesNotContain("mensagem antiga");
    }

    @Test
    void plainTextFromBeforeEncryptionIsReturnedAsIs() {
        assertThat(new ChatCryptoService(SECRET, environment("prod")).decrypt("texto sem criptografia"))
            .isEqualTo("texto sem criptografia");
    }
}
