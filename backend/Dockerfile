# Use official OpenJDK image for Spring Boot
FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

# Copy built jar from build context
COPY backend/target/campusvibe-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java","-jar","app.jar"]
