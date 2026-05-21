FROM rust:slim as builder

WORKDIR /usr/src/app

COPY Cargo.toml ./
# Create a dummy main.rs to compile dependencies first and cache them
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/cloud_security_sentinel*

COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/app/target/release/cloud-security-sentinel /usr/local/bin/cloud-security-sentinel
EXPOSE 8080
CMD ["cloud-security-sentinel"]
