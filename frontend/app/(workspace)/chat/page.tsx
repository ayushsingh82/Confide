import type { Metadata } from "next";
import { ChatWorkspace } from "./ChatWorkspace";

export const metadata: Metadata = {
  title: "Workspace — Confide",
  description: "Confidential AI workspace running on NEAR AI Cloud's TEE.",
};

export default function ChatPage() {
  return <ChatWorkspace />;
}
