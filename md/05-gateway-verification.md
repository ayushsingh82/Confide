# Gateway Verification

> **Direct Completions — No Gateway Verification Needed**
> If you are using direct completions endpoints (e.g., `https://qwen35-122b.completions.near.ai`), your requests go straight to the model's TEE with no gateway in the path. In that case, only Model Verification is needed — you can skip gateway verification entirely.

To verify the NEAR AI Cloud private inference gateway is operating in a secure trusted environment, you need to verify the gateway attestation. The gateway attestation proves that the API gateway itself runs in a Trusted Execution Environment (TEE).

1. Request gateway attestation report from NEAR AI Cloud
2. Verify gateway attestation report using Intel attestation authenticators

> See an example implementation in the NEAR AI Cloud Verifier repo.

## Request Gateway Attestation

The gateway attestation can be requested standalone, or is included in the response when you request a model attestation. To request standalone:

```
GET https://cloud-api.near.ai/v1/attestation/report?signing_algo=ecdsa&nonce={nonce}
```

- `signing_algo` — `ecdsa` or `ed25519`. Specifies the signing algorithm.
- `nonce` — Optional but recommended. A randomly generated 64-character hex string (32 bytes) ensures attestation freshness and prevents replay attacks. If not provided, the server generates one.

If you want to verify that the HTTPS connection to `cloud-api.near.ai` terminates inside the gateway TEE, add `include_tls_fingerprint=true` and follow TLS Attestation Verification. That opt-in flag binds the gateway's TLS certificate fingerprint into `report_data`; it is disabled by default for compatibility with existing clients.

### Example — curl

```bash
# Generate a random 64-character hex nonce (optional but recommended)
NONCE=$(openssl rand -hex 32)

curl "https://cloud-api.near.ai/v1/attestation/report?signing_algo=ecdsa&nonce=${NONCE}" \
  -H 'accept: application/json'
```

## Verifying Gateway Attestation

Once you have the attestation payload, you can verify:

1. **Intel TDX quote** — Verify the TDX quote with the `dcap-qvl` library
2. **TDX report data** — Validate that report data includes the nonce in request
3. **Compose manifest** — Display Docker compose manifest and verify it matches the `mr_config` measurement
4. **Source code provenance** — Verify container image provenance

### Verify TDX Quote

Use `intel_quote` from `gateway_attestation` with the `dcap-qvl` library. Verifies:

- CPU TEE measurements are valid
- Quote is authentic and signed by Intel
- TEE environment is genuine

Alternatively, you can verify the Intel TDX quote at the TEE Attestation Explorer.

### Verify TDX Report Data

Validates that:

- The report data binds the signing address (ECDSA or Ed25519)
- The report data embeds the request nonce

This ensures cryptographic binding between the signing address and the hardware, and prevents replay attacks through nonce freshness.

### Verify Compose Manifest

The attestation response includes Docker compose manifest information in `gateway_attestation.info`. To verify:

1. Extract the Docker compose manifest from the attestation
2. Calculate the SHA-256 hash of the compose manifest
3. Compare it with the `mr_config` measurement from the verified TDX quote
4. Verify they match, proving the exact container configuration

This ensures the exact Docker compose file is deployed to the TEE environment.

### Verify Source Code Provenance

Extract the `nearaidev/cloud-api` container image digests from the Docker compose manifest (matching `@sha256:xxx` patterns) and fetch the source code provenance from Sigstore for each image. This allows you to:

- Verify the container images were built from the expected source repository with exact release tag
- Review the GitHub Actions workflow that built the images
- Audit the build provenance and supply chain metadata
- Audit the source code of a given release

The source code of the `cloud-api` gateway is reproducible — you can build from the source code of a given release and verify that the resulting Docker image digest matches the digest from the attestation (`@sha256:xxx`).

This ensures the exact version of source code is built into the `nearaidev/cloud-api` Docker image and makes it easy to audit and validate the source code. See, for example, the Sigstore link for the `v0.1.7` release of `cloud-api`.
