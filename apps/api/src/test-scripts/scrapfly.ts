// scrapfly.ts
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const API_URL = "https://my.arttix.org/api/syos/GetSeatList?performanceId=37165&facilityId=487&screenId=1";

type Tier = {
  name: string;
  params: Record<string, string>;
  costBudget?: string; // optional per-tier budget cap
};

// Tiers from cheapest → strongest. We'll stop on first success.
const TIERS: Tier[] = [
  {
    name: "datacenter_raw",
    params: {
      url: API_URL,
      retry: "true",
      country: "us",
      proxified_response: "true",
      proxy_pool: "public_datacenter_pool",
      // NO asp, NO render_js
    },
    costBudget: "1", // 1 credit
  },
  {
    name: "datacenter_browser",
    params: {
      url: API_URL,
      retry: "true",
      country: "us",
      proxified_response: "true",
      proxy_pool: "public_datacenter_pool",
      render_js: "true",
      rendering_stage: "domcontentloaded",
    },
    costBudget: "6", // ~6 credits (1 + 5 browser)
  },
  {
    name: "asp_auto",
    params: {
      url: API_URL,
      retry: "true",
      country: "us",
      proxified_response: "true",
      asp: "true", // allow ASP to upgrade as needed
      session: "ticketcheck-arttix",
      session_sticky_proxy: "true",
    },
    costBudget: "30", // allow up to residential+browser if needed
  },
];

function looksLikeXml(s: string) {
  // Basic sanity check that we got XML, not a block page/HTML
  const trimmed = s.trimStart();
  return trimmed.startsWith("<") && /<\/?[A-Za-z][^>]*>/.test(trimmed);
}

async function tryTier(tier: Tier, key: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: string; cost: string | null }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(tier.params)) sp.set(k, v);
  sp.set("key", key);
  if (tier.costBudget) sp.set("cost_budget", tier.costBudget);

  const url = `https://api.scrapfly.io/scrape?${sp.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/xml,text/xml;q=1,*/*;q=0.1",
    },
  });

  const cost = resp.headers.get("X-Scrapfly-Api-Cost");
  const text = await resp.text();

  // Consider a response successful if HTTP 2xx and it looks like XML
  const ok = resp.ok && looksLikeXml(text);
  return { ok, status: resp.status, body: text, cost };
}

async function runOnce() {
  const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY ?? "";
  if (!SCRAPFLY_KEY) throw new Error("SCRAPFLY_KEY env var required");

  // Outer timeout (slightly above Scrapfly internal) to avoid hanging
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 130_000);

  try {
    for (const tier of TIERS) {
      console.log(`\n→ Trying tier: ${tier.name} (cost_budget=${tier.costBudget ?? "none"})`);
      try {
        const res = await tryTier(tier, SCRAPFLY_KEY, controller.signal);
        console.log(`Status: ${res.status} | X-Scrapfly-Api-Cost: ${res.cost ?? "?"}`);
        if (res.ok) {
          console.log("✓ Success with tier:", tier.name);
          console.log(res.body);
          return; // stop at first success
        } else {
          console.log(`Tier ${tier.name} did not return valid XML. Upgrading...`);
        }
      } catch (e: any) {
        console.log(`Tier ${tier.name} error:`, e?.message ?? e);
      }
    }
    throw new Error("All tiers failed to produce valid XML");
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  // Usage: npx ts-node -P apps/api/tsconfig.json apps/api/src/test-scripts/scrapfly.ts 3
  const countArg = process.argv[2];
  const runs = Math.max(1, Number.isFinite(Number(countArg)) ? Number(countArg) : 1);

  for (let i = 1; i <= runs; i++) {
    if (runs > 1) console.log(`\n===== Run ${i}/${runs} =====`);
    await runOnce();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});