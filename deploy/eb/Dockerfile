# Production image for Elastic Beanstalk (Docker on Amazon Linux 2023).
#
# This is NOT the same file as backend/Dockerfile, and the difference is
# deliberate. backend/Dockerfile is built by Compose with the build context set
# to the repo root, so its COPY path is `backend/target/...`. Elastic Beanstalk
# builds whatever it finds at the root of the source bundle, where there is no
# repo — only this file and the jar beside it. One Dockerfile cannot satisfy
# both context shapes, and making Compose match EB would mean shipping the whole
# repository to the instance on every deploy.
#
# The jar is built on the developer machine (or in CI) and dropped next to this
# file by scripts/package-eb.mjs. The alternative — a multi-stage build that
# runs Maven on the instance, as sketched in the deployment guide section 3 —
# was rejected: a t3.micro has 1 GiB of RAM and 2 burstable vCPUs, so the build
# would take minutes of deploy time and can be killed by the OOM reaper, on the
# same box that has to serve traffic afterwards.

FROM eclipse-temurin:25-jre-alpine

# Run unprivileged. The application binds 8080, so it never needs a low port.
RUN addgroup -S campusvibe && adduser -S campusvibe -G campusvibe

WORKDIR /app
COPY app.jar app.jar
USER campusvibe

# Elastic Beanstalk reads EXPOSE to decide where its nginx proxy should send
# traffic. It must match server.port in application.yml.
EXPOSE 8080

# MaxRAMPercentage, not -Xmx: the instance is small and the figure should track
# the container rather than be re-tuned by hand when the instance type changes.
# ExitOnOutOfMemoryError so the platform restarts a wedged JVM instead of
# leaving one that answers health checks while failing every request.
ENTRYPOINT ["java", \
            "-XX:MaxRAMPercentage=60.0", \
            "-XX:+ExitOnOutOfMemoryError", \
            "-jar", "/app/app.jar"]
