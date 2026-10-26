package br.com.sap.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/*
 * Criptografia das mensagens do chat (AES-GCM, chave = SHA-256 de sap.chat.secret).
 *
 * No perfil prod a chave vem obrigatoriamente de SAP_CHAT_SECRET: valor ausente,
 * vazio ou igual à chave padrão pública impede a inicialização. Fora de prod a
 * chave padrão continua disponível para desenvolvimento e testes. A derivação da
 * chave não muda, então mensagens já gravadas continuam legíveis com a mesma chave.
 * As mensagens de erro citam apenas o nome da variável, nunca o valor.
 */
@Service
public class ChatCryptoService {
    static final String CHAVE_PADRAO_PUBLICA = "SAP-CHAT-SECRET-CHANGE-ME-2026";
    private static final String PREFIX = "ENC:v1:";
    private static final int IV_SIZE = 12;
    private static final int TAG_BITS = 128;
    private final SecretKeySpec keySpec;
    private final SecureRandom secureRandom = new SecureRandom();

    public ChatCryptoService(@Value("${sap.chat.secret:" + CHAVE_PADRAO_PUBLICA + "}") String secret,
                             Environment environment) {
        if (environment.matchesProfiles("prod")) {
            validarChaveDeProducao(secret);
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            this.keySpec = new SecretKeySpec(Arrays.copyOf(hash, 32), "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível inicializar criptografia do chat", e);
        }
    }

    static void validarChaveDeProducao(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("SAP_CHAT_SECRET ausente ou vazia no perfil prod.");
        }
        if (secret.strip().equals(CHAVE_PADRAO_PUBLICA)) {
            throw new IllegalStateException("SAP_CHAT_SECRET não pode ser a chave padrão pública no perfil prod.");
        }
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) return plainText;
        if (plainText.startsWith(PREFIX)) return plainText;
        try {
            byte[] iv = new byte[IV_SIZE];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível criptografar mensagem do chat", e);
        }
    }

    public String decrypt(String storedText) {
        if (storedText == null || !storedText.startsWith(PREFIX)) return storedText;
        try {
            String raw = storedText.substring(PREFIX.length());
            String[] parts = raw.split(":", 2);
            if (parts.length != 2) return storedText;
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] encrypted = Base64.getDecoder().decode(parts[1]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "[mensagem criptografada indisponível]";
        }
    }
}
