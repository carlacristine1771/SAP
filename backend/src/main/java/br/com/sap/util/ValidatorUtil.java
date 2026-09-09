package br.com.sap.util;

import java.util.regex.Pattern;

public class ValidatorUtil {

    private ValidatorUtil() {
    }

    public static boolean emailValido(
            String email
    ) {

        if (email == null || email.isBlank()) {
            return false;
        }

        String regex =
                "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$";

        return Pattern.matches(regex, email);
    }

    public static boolean cpfValido(
            String cpf
    ) {

        if (cpf == null) {
            return false;
        }

        cpf = cpf.replaceAll("[^0-9]", "");

        return cpf.length() == 11;
    }

    public static boolean telefoneValido(
            String telefone
    ) {

        if (telefone == null) {
            return false;
        }

        telefone = telefone.replaceAll("[^0-9]", "");

        return telefone.length() >= 10
                && telefone.length() <= 11;
    }

    public static boolean textoVazio(
            String texto
    ) {

        return texto == null || texto.isBlank();
    }
}