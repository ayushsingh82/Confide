package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"
)

// generateSelfSignedCert mints an ephemeral TLS keypair at boot and computes
// its SPKI hash — the value a browser (or the backend, before minting a JWT)
// binds against the TDX quote's report_data, per md/06-tls-attestation.md.
// The TEE generates its own key; it is intentionally not CA-signed — trust
// comes from hardware attestation, not a certificate authority.
func generateSelfSignedCert() (tls.Certificate, string, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, "", err
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return tls.Certificate{}, "", err
	}

	template := x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: "confide-cvm"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IsCA:         true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return tls.Certificate{}, "", err
	}

	spkiDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	spkiSum := sha256.Sum256(spkiDER)
	spkiHash := hex.EncodeToString(spkiSum[:])

	cert := tls.Certificate{
		Certificate: [][]byte{derBytes},
		PrivateKey:  priv,
	}
	return cert, spkiHash, nil
}

func newTLSConfig() (*tls.Config, string, error) {
	cert, spkiHash, err := generateSelfSignedCert()
	if err != nil {
		return nil, "", fmt.Errorf("generating self-signed cert: %w", err)
	}
	cfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}
	return cfg, spkiHash, nil
}
