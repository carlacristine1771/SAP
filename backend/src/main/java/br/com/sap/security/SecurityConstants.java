package br.com.sap.security;

public class SecurityConstants {

    public static final String SECRET_KEY =
            "sap_secret_key_jwt_2026";

    public static final long EXPIRATION_TIME =
            1000 * 60 * 60 * 24;

    public static final String TOKEN_PREFIX =
            "Bearer ";

    public static final String HEADER_STRING =
            "Authorization";

    public static final String AUTH_COOKIE = "SAP_AUTH";

    public static final String SESSION_COOKIE = "SAP_SESSION";

    private SecurityConstants() {
    }
}