# Start from a minimal base image
FROM alpine:3.17

# Copy the Go binary from the build stage
COPY server /server
COPY static/ /static
ENV TEXT_PATH=/data
ENV SESSION_FILE=/secrets/sessions.json
ENV MASTER_PASSWORDS_FILE=/secrets/master_passwords.json

RUN apk add --no-cache ca-certificates

# Set the working directory
WORKDIR /

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /server /static
USER appuser

# Set the entry point
ENTRYPOINT ["/server"]