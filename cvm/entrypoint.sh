#!/bin/bash
# Egress allowlist: default-DROP on OUTPUT, explicit ALLOW for the domains a
# cloned repo's toolchain and the agent itself legitimately need. Matches the
# list in md/plan.md §12 / md/08-playground-design.md. This *requires*
# NET_ADMIN (iptables) — if the container doesn't have it (e.g. this dev
# sandbox's default `docker run`), we skip enforcement loudly rather than
# silently pretend it's active.
set -euo pipefail

ALLOWED_HOSTS=(
  github.com
  objects.githubusercontent.com
  registry.npmjs.org
  pypi.org
  files.pythonhosted.org
  proxy.golang.org
  sum.golang.org
  crates.io
  static.crates.io
  cloud-api.near.ai
  pool.ntp.org
  nras.attestation.nvidia.com
)

setup_egress_allowlist() {
  if ! command -v iptables >/dev/null 2>&1; then
    echo "[entrypoint] iptables not installed — skipping egress allowlist" >&2
    return 1
  fi
  if ! iptables -L >/dev/null 2>&1; then
    echo "[entrypoint] iptables unusable (no NET_ADMIN?) — skipping egress allowlist" >&2
    return 1
  fi

  iptables -P OUTPUT DROP
  iptables -A OUTPUT -o lo -j ACCEPT
  # Return traffic for connections *into* the agent (the browser/backend's WS
  # session on :8443) must be allowed regardless of the destination allowlist
  # below, or every inbound connection's replies get silently dropped.
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -A OUTPUT -p udp --dport 53 -j ACCEPT   # DNS
  iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
  iptables -A OUTPUT -p udp --dport 123 -j ACCEPT  # NTP

  for host in "${ALLOWED_HOSTS[@]}"; do
    for ip in $(getent ahostsv4 "$host" | awk '{print $1}' | sort -u); do
      iptables -A OUTPUT -d "$ip" -j ACCEPT
    done
  done
  echo "[entrypoint] egress allowlist active for: ${ALLOWED_HOSTS[*]}" >&2
  return 0
}

if [ "${CONFIDE_SKIP_EGRESS_ALLOWLIST:-}" != "1" ]; then
  setup_egress_allowlist || echo "[entrypoint] WARNING: running WITHOUT an egress allowlist" >&2
fi

exec /usr/local/bin/confide-agent
