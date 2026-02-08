# syntax=docker/dockerfile:1

# ---------- Frontend Build Stage ----------
FROM node:24-slim AS frontend
WORKDIR /app/carpaintr-front
COPY carpaintr-front/package*.json ./
RUN npm install
COPY carpaintr-front/ .
RUN npm run build --production

# ---------- Backend Build Stage ----------
FROM rust:1.93 AS backend
WORKDIR /app/backend-service-rust
# Create dummy static to prevent cargo build issues before copying frontend
RUN mkdir -p static
# Copy backend source for dependencies only
COPY backend-service-rust/Cargo.toml ./
# Build a dummy with only dependencies to cache them
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release
# Remove dummy source
RUN rm -rf src

# Copy all backend source
COPY backend-service-rust/ .
# Copy frontend build artifacts
COPY --from=frontend /app/carpaintr-front/dist ./static
# Build backend in release mode
RUN touch src/main.rs && cargo build --release

# ---------- Runtime Stage ----------
FROM debian:stable-slim
# Install only necessary runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates git rsync --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy only the binary and static files
COPY --from=backend /app/backend-service-rust/target/release/rust-web-service /app/backend
COPY --from=backend /app/backend-service-rust/static /app/static
COPY data/ /var/initialdata
COPY entrypoint.sh /entrypoint.sh

# Set the binary as the entrypoint for better container behavior
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 8080