FROM eclipse-temurin:25-jdk-alpine

WORKDIR /app

# Pinned rather than inherited from the base image's LANG: a locale or time
# zone must never change what the backend does (BUG-001, where a French FORMAT
# locale turned 0.7 into 0,700000 inside a SQL string).
ENV JAVA_TOOL_OPTIONS="-Duser.language=en -Duser.country=US -Duser.timezone=UTC"

# Copy built jar from build context
COPY backend/target/campusvibe-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java","-jar","app.jar"]
