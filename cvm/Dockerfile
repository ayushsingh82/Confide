# confide-cvm — the image that (eventually) runs inside a real Intel TDX
# confidential VM. Today it also doubles as the local test target for the
# confide-agent binary — see cvm/agent/ for the Go source and
# md/plan.md §12 for the full design.

FROM golang:1.23-bookworm AS build
WORKDIR /src
COPY agent/go.mod agent/go.sum ./
RUN go mod download
COPY agent/*.go ./
RUN CGO_ENABLED=0 go build -o /out/confide-agent .

FROM debian:12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git iptables iproute2 dnsutils \
      python3 python3-pip \
      build-essential ripgrep bash \
    && rm -rf /var/lib/apt/lists/*

# Node 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Rust / cargo
ENV CARGO_HOME=/usr/local/cargo RUSTUP_HOME=/usr/local/rustup PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal

# Go toolchain (for repos that build Go code inside the sandbox — separate
# from the build-stage Go used to compile confide-agent itself)
COPY --from=golang:1.23-bookworm /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH

COPY --from=build /out/confide-agent /usr/local/bin/confide-agent
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN mkdir -p /workspace
ENV WORKSPACE_ROOT=/workspace
ENV AGENT_ADDR=:8443

EXPOSE 8443
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
