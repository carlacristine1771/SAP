package br.com.sap.util;

import java.time.LocalDate;
import java.time.LocalDateTime;

import java.time.format.DateTimeFormatter;

public class DateUtil {

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final DateTimeFormatter DATE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private DateUtil() {
    }

    public static String formatarData(
            LocalDate data
    ) {

        if (data == null) {
            return null;
        }

        return data.format(DATE_FORMAT);
    }

    public static String formatarDataHora(
            LocalDateTime dataHora
    ) {

        if (dataHora == null) {
            return null;
        }

        return dataHora.format(DATE_TIME_FORMAT);
    }

    public static LocalDate converterParaData(
            String data
    ) {

        return LocalDate.parse(data, DATE_FORMAT);
    }

    public static LocalDateTime converterParaDataHora(
            String dataHora
    ) {

        return LocalDateTime.parse(
                dataHora,
                DATE_TIME_FORMAT
        );
    }
}