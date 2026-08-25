package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	addr := os.Getenv("AGENT_ADDR")
	if addr == "" {
		addr = ":8443"
	}

	if err := os.MkdirAll(workspaceRoot(), 0o755); err != nil {
		log.Fatalf("failed to create workspace root %s: %v", workspaceRoot(), err)
	}

	tlsConfig, spkiHash, err := newTLSConfig()
	if err != nil {
		log.Fatalf("failed to set up TLS: %v", err)
	}
	log.Printf("confide-agent booting — spki=%s workspace=%s", spkiHash, workspaceRoot())

	att := checkAttestation(spkiHash)
	log.Printf("attestation check: available=%v reason=%q", att.Available, att.Reason)

	mux := http.NewServeMux()
	mux.HandleFunc("/agent", agentHandler(spkiHash))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	server := &http.Server{
		Addr:      addr,
		Handler:   mux,
		TLSConfig: tlsConfig,
	}

	log.Printf("confide-agent listening on %s", addr)
	// ListenAndServeTLS with empty cert/key paths uses server.TLSConfig's
	// pre-loaded certificate (set above) instead of reading from disk.
	if err := server.ListenAndServeTLS("", ""); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
