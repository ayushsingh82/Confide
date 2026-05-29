// Inline SVG data URIs for provider mark badges used in the OrbitImages component.
// Renders crisply on dark backgrounds; no external network dependency.

function makeBadge(letter: string, bg: string, fg = "#fff") {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='${bg}'/><text x='50' y='54' text-anchor='middle' dominant-baseline='middle' font-family='-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,sans-serif' font-size='52' font-weight='700' fill='${fg}'>${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PROVIDER_LOGOS = [
  { name: "OpenAI", url: makeBadge("O", "#10A37F") },
  { name: "Anthropic", url: makeBadge("A", "#D97757") },
  { name: "Google", url: makeBadge("G", "#4285F4") },
  { name: "DeepSeek", url: makeBadge("D", "#4D6BFE") },
  { name: "Alibaba / Qwen", url: makeBadge("Q", "#7C3AED") },
  { name: "Z.ai / GLM", url: makeBadge("Z", "#14B8A6") },
  { name: "Moonshot / Kimi", url: makeBadge("K", "#0F172A", "#E2E8F0") },
  { name: "Black Forest Labs / FLUX", url: makeBadge("F", "#1F2937") },
];

export const PROVIDER_LOGO_URLS = PROVIDER_LOGOS.map((p) => p.url);

/** Hosted brand logos for the providers we have real artwork for. */
const ANTHROPIC_LOGO =
  "https://media.licdn.com/dms/image/v2/D4E0BAQFko-zWIZk_pw/company-logo_200_200/B4EZhiRWKvHgAI-/0/1753995371543/claude_logo?e=2147483647&v=beta&t=CVNmFKyWig0Uo78oAr3II6KVLu_o0aXPtnt4S6XgOr8";
const GOOGLE_LOGO =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSYCSbajNbQ_pkt_MNnumy90HxSCt06M_BYA&s";
const DEEPSEEK_LOGO =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8kb3djVaVAlVIpCV7JBbe4lh4uxHfGPk1ow&s";
const OPENAI_LOGO =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQa7aja0wWWohwV3UZsenQQa0mmjeNovFUX9g&s";
const QWEN_LOGO =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTLuSr6R7xTtmzvDF6-gYI2KQUWQGEqOML4YQ&s";

/** Look up the brand logo for a model creator. */
export function logoForCreator(creator: string): string {
  const c = creator.toLowerCase();
  if (c.includes("anthropic")) return ANTHROPIC_LOGO;
  if (c.includes("google")) return GOOGLE_LOGO;
  if (c.includes("deepseek")) return DEEPSEEK_LOGO;
  if (c.includes("openai")) return OPENAI_LOGO;
  if (c.includes("alibaba") || c.includes("qwen")) return QWEN_LOGO;
  if (c.includes("z.ai") || c.includes("zai") || c.includes("glm"))
    return makeBadge("Z", "#14B8A6");
  if (c.includes("moonshot") || c.includes("kimi"))
    return makeBadge("K", "#0F172A", "#E2E8F0");
  if (c.includes("black forest") || c.includes("flux")) return makeBadge("F", "#1F2937");
  return makeBadge(creator.charAt(0).toUpperCase(), "#525252");
}

/** Public URL for the NEAR brand mark (CoinMarketCap mirror). */
export const NEAR_LOGO_URL =
  "https://s3.coinmarketcap.com/static-gravity/image/ef3ad80e423a4449ab8e961b0d1edea4.png";
