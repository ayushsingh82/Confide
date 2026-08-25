package main

import "os"

// attestResult is what attest.report resolves to. Available=false is the
// honest, expected outcome everywhere except a genuine TDX host — it must
// never be papered over with a fabricated quote.
type attestResult struct {
	Available      bool
	Reason         string
	Quote          string
	Spki           string
	SigningAddress string
}

// tdxDevicePaths are the two known kernel interfaces for requesting a TDX
// quote: the legacy /dev/tdx-attest char device, and the newer configfs-tsm
// interface (kernel 6.7+) at /sys/kernel/config/tsm/report. Neither exists
// outside a real TDX guest — including this dev container.
var tdxDevicePaths = []string{
	"/dev/tdx-attest",
	"/sys/kernel/config/tsm/report",
}

func checkAttestation(spkiHash string) attestResult {
	for _, p := range tdxDevicePaths {
		if _, err := os.Stat(p); err == nil {
			// A real interface exists. Actually requesting + parsing a quote
			// through it is real hardware I/O this project hasn't built or
			// tested yet (no TDX host available) — report that explicitly
			// rather than attempt it half-built.
			return attestResult{
				Available: false,
				Reason:    "TDX device " + p + " present, but quote generation is not yet implemented in this agent",
			}
		}
	}
	return attestResult{
		Available: false,
		Reason:    "not running inside a TDX confidential VM (no /dev/tdx-attest or configfs-tsm interface found)",
	}
}
