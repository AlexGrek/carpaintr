# syntax=docker/dockerfile:1

# ---------- Frontend Build Stage ----------
FROM node:24-slim AS frontend

WORKDIR /app

COPY carpaintr-front/ ./carpaintr-front
WORKDIR /app/carpaintr-front

RUN npm install
RUN npm run build

# ---------- Backend Build Stage ----------
FROM rust:1.86 AS backend

WORKDIR /app

# Create dummy static to prevent cargo build issues
RUN mkdir -p backend-service-rust/static

# Copy backend source
COPY backend-service-rust/ ./backend-service-rust
COPY --from=frontend /app/carpaintr-front/dist ./backend-service-rust/static

WORKDIR /app/backend-service-rust

# Build backend in release mode
RUN cargo build --release

# ---------- Runtime Stage ----------
FROM debian:stable-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the binary and static files
COPY --from=backend /app/backend-service-rust/target/release/backend /app/backend
COPY --from=backend /app/backend-service-rust/static /app/static

EXPOSE 8080

CMD ["/app/backend"]
