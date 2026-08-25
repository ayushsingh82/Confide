package main

// handleChatComplete would forward a chat.complete frame to NEAR AI Cloud
// using a short-lived key leased from the Confide backend (so the long-lived
// NEAR_API_KEY never enters the CVM image). That leasing mechanism doesn't
// exist yet — designing it is separate work (a JWT-scoped key lease endpoint
// on the backend, plus the CVM pulling it at boot or per-request). Until
// then this returns an explicit error frame rather than faking a completion
// or reaching for a key that isn't there.
func handleChatComplete(correlationID string) AgentFrame {
	return frameError(
		correlationID,
		"not_implemented",
		"chat.complete is not implemented yet: the CVM has no mechanism to lease a scoped NEAR API key from the backend. See cvm/agent/chat.go.",
	)
}
