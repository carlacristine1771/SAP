package br.com.sap.controller;

import br.com.sap.service.DashboardService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/admin")
    public ResponseEntity<?> dashboardAdmin() {

        return ResponseEntity.ok(
                dashboardService.dashboardAdmin()
        );
    }

    @GetMapping("/psicologo")
    public ResponseEntity<?> dashboardPsicologo() {

        return ResponseEntity.ok(
                dashboardService.dashboardPsicologo()
        );
    }

    @GetMapping("/coordenacao")
    public ResponseEntity<?> dashboardCoordenacao() {

        return ResponseEntity.ok(
                dashboardService.dashboardCoordenacao()
        );
    }

    @GetMapping("/instrutor")
    public ResponseEntity<?> dashboardInstrutor() {

        return ResponseEntity.ok(
                dashboardService.dashboardInstrutor()
        );
    }
}