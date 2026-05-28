# TLS Attestation Verification

NEAR AI runs inference models inside Confidential VMs (CVMs) — virtual machines backed by Intel TDX hardware that provide a Trusted Execution Environment (TEE). The key property: **even the cloud operator cannot see or tamper with what runs inside the TEE.**

TLS attestation proves that the TLS connection used for your HTTPS requests terminates directly inside the TEE, ensuring your messages remain encrypted end-to-end.

## What TLS Attestation Proves

TLS attestation binds the server's TLS certificate to the TEE hardware attestation:

1. You request `/v1/attestation/report?include_tls_fingerprint=true`.
2. The TEE computes the certificate's SPKI hash (SHA-256 of the `SubjectPublicKeyInfo`) and binds it into the attested `report_data`.
3. Intel TDX hardware signs this quote — it cannot be forged.
4. You verify the quote, then confirm the live TLS certificate matches the attested hash.

This proves the TLS private key is held by the TEE. Your HTTPS traffic is end-to-end encrypted all the way to the hardware enclave.

## Opt-In Behavior

`include_tls_fingerprint` is **disabled by default** so existing attestation clients keep the original `report_data` layout.

- Without the flag — `report_data[0:32]` = signing address bytes (padded or truncated to 32 bytes).
- With the flag — `report_data[0:32]` = `SHA256(signing_address || tls_cert_fingerprint)`.

## Trust Model

You trust:

- Intel TDX hardware (CPU attestation)
- NVIDIA GPU hardware (GPU attestation)
- The code running inside the TEE (verified via compose file hash)

You **do not** need to trust the cloud operator, network infrastructure, or certificate authorities.

```
Intel TDX Hardware ─▶ TDX Quote (signed by CPU)
NVIDIA GPU Hardware ─▶ GPU Attestation (NVIDIA NRAS)

mr_config_id
   ↓
Docker Compose file
   ↓
Container images

report_data[0:32] ─▶ SHA256(signing_address || tls_cert_fingerprint)
report_data[32:64] ─▶ nonce (freshness)

Live TLS cert match ─▶ Your HTTPS connection
```

## Prerequisites

```bash
pip install dcap-qvl cryptography requests pyyaml
```

## Verifications

### 1. Discover Available Endpoints

```python
import http.client
import json

conn = http.client.HTTPSConnection("completions.near.ai")
conn.request("GET", "/endpoints")
resp = conn.getresponse()
endpoints_data = json.loads(resp.read())
conn.close()

domain_models = {}
for entry in endpoints_data.get("endpoints", []):
    domain = entry["domain"]
    domain_models[domain] = entry.get("models", [])
    print(f"{domain:<45} {', '.join(domain_models[domain])}")

TARGET_DOMAIN = "glm-5.completions.near.ai"
```

### 2. Fetch Attestation + Live SPKI Hash on One Connection

Multiple backend CVMs may serve the same domain via load balancing. Making two separate connections — one for attestation, one to check the certificate — could hit different backends and produce a false SPKI mismatch.

The solution: extract the live certificate **and** make the attestation request **over the same TLS connection**.

> CA verification is intentionally skipped. The TEE generates its own TLS key pair — it is not CA-signed. Trust comes from the TEE hardware attestation, not from Certificate Authorities.

```python
import ssl
import secrets
from hashlib import sha256
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization


def compute_spki_hash(cert_der: bytes) -> str:
    cert = x509.load_der_x509_certificate(cert_der, default_backend())
    spki_der = cert.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return sha256(spki_der).hexdigest()


def fetch_attestation_and_spki(hostname, port=443, signing_algo="ecdsa"):
    nonce = secrets.token_hex(32)

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    conn = http.client.HTTPSConnection(hostname, port, context=context, timeout=60)
    conn.connect()

    cert_der = conn.sock.getpeercert(binary_form=True)
    if not cert_der:
        conn.close()
        raise Exception("Failed to get certificate from server")
    live_spki_hash = compute_spki_hash(cert_der)

    path = (
        f"/v1/attestation/report"
        f"?include_tls_fingerprint=true&nonce={nonce}&signing_algo={signing_algo}"
    )
    conn.request("GET", path, headers={"Host": hostname})
    resp = conn.getresponse()
    body = resp.read()
    conn.close()

    if resp.status != 200:
        raise Exception(f"HTTP {resp.status}: {body.decode()}")

    return json.loads(body), live_spki_hash, nonce


attestation, live_spki_hash, request_nonce = fetch_attestation_and_spki(TARGET_DOMAIN)
```

Query parameters:

| Param | Description |
|---|---|
| `include_tls_fingerprint=true` | Tells the TEE to include its TLS cert's SPKI hash in the report data |
| `nonce` | Random 32-byte hex string; included in the report to prove freshness |
| `signing_algo` | `ecdsa` (secp256k1) or `ed25519` |

### 3. Verify the Intel TDX Quote

```python
import dcap_qvl

intel_quote_bytes = bytes.fromhex(attestation["intel_quote"])
result = await dcap_qvl.get_collateral_and_verify(intel_quote_bytes)
result_json = json.loads(result.to_json())

td10 = result_json["report"]["TD10"]
report_data_hex = td10["report_data"]
mr_config_id = td10["mr_config_id"]
```

| Status | Meaning |
|---|---|
| `UpToDate` | Quote is valid, TCB firmware is current |
| `SWHardeningNeeded` | Quote is valid but has advisories — check `advisory_ids` |
| Any other | Verification failed |

Key fields extracted:

| Field | What it proves |
|---|---|
| `report_data[0:32]` | `SHA256(signing_address ∥ tls_cert_fingerprint)` — binds signing key + TLS cert to this TEE |
| `report_data[32:64]` | The nonce — proves the attestation is fresh, not a replay |
| `mr_config_id` | `"01" + SHA256(app_compose)` — binds the Docker Compose file to this TEE |

### 4. Verify Report Data Binds Signing Key + TLS Cert

```python
report_data = bytes.fromhex(report_data_hex.removeprefix("0x"))
signing_algo = attestation.get("signing_algo", "ecdsa").lower()

if signing_algo == "ecdsa":
    signing_address_bytes = bytes.fromhex(attestation["signing_address"].removeprefix("0x"))
else:
    signing_address_bytes = bytes.fromhex(attestation["signing_address"])

cert_fp_bytes = bytes.fromhex(attestation["tls_cert_fingerprint"])
expected_hash = sha256(signing_address_bytes + cert_fp_bytes).digest()

binds_key_and_tls = report_data[:32] == expected_hash
embeds_nonce = report_data[32:].hex() == request_nonce
```

### 5. Verify Live TLS Certificate Matches Attested Fingerprint

```python
attested_fingerprint = attestation["tls_cert_fingerprint"]
tls_match = live_spki_hash == attested_fingerprint
```

A match proves the TLS connection terminates inside the TEE.

### 6. Verify Model Name

```python
attested_model = attestation.get("model_name")
expected_models = domain_models.get(TARGET_DOMAIN, [])
model_match = attested_model in expected_models
```

### 7. Verify GPU Attestation

```python
import base64
import requests

GPU_VERIFIER_API = "https://nras.attestation.nvidia.com/v3/attest/gpu"


def decode_jwt_payload(jwt_token):
    payload_b64 = jwt_token.split(".")[1]
    padded = payload_b64 + "=" * ((4 - len(payload_b64) % 4) % 4)
    return json.loads(base64.urlsafe_b64decode(padded).decode())


nvidia_payload_str = attestation.get("nvidia_payload")
if nvidia_payload_str:
    payload = json.loads(nvidia_payload_str)
    gpu_nonce_matches = payload["nonce"].lower() == request_nonce.lower()

    nras_resp = requests.post(GPU_VERIFIER_API, json=payload, timeout=30)
    jwt_token = nras_resp.json()[0][1]
    verdict = decode_jwt_payload(jwt_token)
    overall_result = verdict["x-nvidia-overall-att-result"]
```

### 8. Verify Docker Compose File

```python
import re
import yaml

tcb_info = attestation["info"]["tcb_info"]
if isinstance(tcb_info, str):
    tcb_info = json.loads(tcb_info)

app_compose_str = tcb_info.get("app_compose")
if app_compose_str:
    app_compose = json.loads(app_compose_str)
    docker_compose_yaml = app_compose["docker_compose_file"]

    compose_hash = sha256(app_compose_str.encode()).hexdigest()
    expected_mr_config = "01" + compose_hash
    compose_matches = mr_config_id.lower().startswith(expected_mr_config.lower())

    digest_pattern = r'@sha256:([0-9a-f]{64})'
    unique_digests = list(dict.fromkeys(re.findall(digest_pattern, docker_compose_yaml)))
```

> `mr_config_id` may be all zeros on some endpoints during TEE configuration transitions. Skip this check if so — the other guarantees still hold.

**Cross-reference with GitHub:** Compose files come from the public repo `nearai/cvm-compose-files`. Fetch by tag and compare byte-for-byte.

**Sigstore provenance:** Container images are pinned by `@sha256:` digest. Check `https://search.sigstore.dev/?hash=sha256:<digest>` for each image to confirm a traceable GitHub Actions build.

## Caching Verified Certificates for Production

Running the full flow takes several seconds. For production, cache the verified SPKI hash and check it on every connection.

Once you've verified a particular SPKI hash is bound to a TEE via hardware attestation, reuse it:

1. Connect via TLS
2. Extract the live certificate's SPKI hash
3. Compare against your cached, previously-verified hash
4. If it matches → same TEE — no full attestation needed

### Build the cache

```python
trusted_certs = {}

for domain in domain_models:
    try:
        att, spki, nonce = fetch_attestation_and_spki(domain)
        tls_fp = att.get("tls_cert_fingerprint")
        if tls_fp and spki == tls_fp:
            trusted_certs[domain] = {
                "spki_hash": spki,
                "model_name": att.get("model_name"),
                "signing_address": att["signing_address"],
            }
    except Exception as e:
        print(f"ERROR {domain}: {e}")
```

### Verify on every connection

```python
def verified_request(domain, method, path, body=None, headers=None, port=443):
    if domain not in trusted_certs:
        raise Exception(f"No cached SPKI for {domain}. Run full attestation first.")

    cached_spki = trusted_certs[domain]["spki_hash"]

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    conn = http.client.HTTPSConnection(domain, port, context=context, timeout=30)
    conn.connect()

    live_spki = compute_spki_hash(conn.sock.getpeercert(binary_form=True))
    if live_spki != cached_spki:
        conn.close()
        raise Exception(f"SPKI mismatch for {domain}! Re-run full attestation.")

    all_headers = {"Host": domain, **(headers or {})}
    conn.request(method, path, body=body, headers=all_headers)
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, json.loads(data)
```

**When to re-verify:** SPKI hash changes (cert rotated with a new key), TEE redeployed, or cached entry expires (24-hour TTL is a reasonable default).

## Verification Summary

| Check | What it proves |
|---|---|
| Intel TDX quote | Attestation comes from genuine Intel TDX hardware |
| Report data binding | Signing key + TLS cert are bound to this specific TEE |
| Live TLS match | Your HTTPS connection terminates inside the TEE |
| Model name | The TEE is running the model you expect |
| GPU attestation | NVIDIA GPUs are in verified confidential computing mode |
| Compose file hash | `mr_config_id` matches `SHA256(app_compose)` — exact code verified |
| GitHub cross-reference | Compose file matches the public source at `nearai/cvm-compose-files` |
| Sigstore provenance | Container images were built by a traceable CI pipeline |
