# ---------- ETAPA 1: build ----------
FROM gradle:jdk17 AS build
WORKDIR /app

COPY build.gradle settings.gradle* ./
COPY src ./src

RUN gradle clean bootJar -x test --no-daemon

# ---------- ETAPA 2: run ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]