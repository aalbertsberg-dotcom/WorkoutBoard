// WorkSet Food Search Proxy
// USDA and FatSecret credentials must be configured in Supabase Edge Function Secrets.
// NEVER put provider keys or FatSecret tokens into VITE_ variables, logs, git, or client responses.
// FatSecret's storable-data terms permit only food_id / serving_id retention. The
// results returned here are live SEARCH PREVIEWS only and must not be saved to the diary.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { normalizeUsdaSearchFood } from "./usdaNutrition.js";
import { planFoodSearch, restaurantMatches } from "./foodSearchPlan.js";

const allowedOrigins = new Set([
  "https://aalbertsberg-dotcom.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
]);
const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    ...(allowedOrigins.has(origin) ? {"Access-Control-Allow-Origin": origin} : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
};
const reply = (req: Request, status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

const numeric = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const round = (v: number) => Math.round(v * 10) / 10;
const cap = (value: unknown, length = 180) => String(value ?? "").slice(0, length);
const tokenState: { token: string; expiresAt: number } = { token: "", expiresAt: 0 };
const requests = new Map<string, number[]>();

const takeSlot = (id: string) => {
  const now = Date.now();
  const current = (requests.get(id) || []).filter(t => now - t < 60_000);
  if (current.length >= 12) return false;
  current.push(now);
  requests.set(id, current);
  if (requests.size > 500) requests.clear(); // per-isolate cap; not a global quota
  return true;
};
const queryUsda = async (term: string) => {
  const key = Deno.env.get("WORKSET_USDA_API_KEY");
  if (!key) return { status: "not_configured", foods: [] };
  const plan = planFoodSearch(term);
  const fetchUsda = async (onlyCommon: boolean) => {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", key);
    const body: Record<string, unknown> = {
      query: plan.restaurant ? plan.restaurant : term,
      pageSize: 35, pageNumber: 1,
    };
    // For ordinary eggs, rice or meats, prefer actual common-food records
    // rather than letting hundreds of branded sweets crowd out the results.
    if (onlyCommon) body.dataType = ["Foundation","SR Legacy","Survey (FNDDS)"];
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) throw Error("USDA HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data?.foods)) throw Error("USDA response invalid");
    return data.foods.map(normalizeUsdaSearchFood).filter(Boolean).slice(0,30);
  };
  let foods = await fetchUsda(plan.common);
  if (!foods.length && plan.common) foods = await fetchUsda(false);
  return { status: "ok", foods };
};

const queryUsdaDetails = async (fdcId: string) => {
  const key = Deno.env.get("WORKSET_USDA_API_KEY");
  if (!key) throw Error("USDA is not configured");
  if (!/^[0-9]{1,12}$/.test(fdcId)) throw Error("Invalid USDA food identifier");
  const url = new URL("https://api.nal.usda.gov/fdc/v1/food/" + fdcId);
  url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw Error("USDA details unavailable");
  const food = normalizeUsdaSearchFood(await response.json());
  if (!food) throw Error("No usable USDA food information");
  return food;
};

const accessToken = async () => {
  if (tokenState.token && tokenState.expiresAt > Date.now() + 60000)
    return tokenState.token;
  const id = Deno.env.get("WORKSET_FATSECRET_CLIENT_ID");
  const secret = Deno.env.get("WORKSET_FATSECRET_CLIENT_SECRET");
  if (!id || !secret) return null;
  const encoded = btoa(id + ":" + secret);
  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + encoded,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("FatSecret authentication unavailable (" + response.status + ")");
  const data = await response.json();
  if (!data?.access_token) throw Error("FatSecret token response invalid");
  tokenState.token = String(data.access_token);
  tokenState.expiresAt = Date.now() + Math.max(300, Math.min(86400, Number(data.expires_in) || 3600)) * 1000;
  return tokenState.token;
};
const queryFatSecret = async (term: string) => {
  const token = await accessToken();
  if (!token) return { status: "not_configured", foods: [] };
  const plan = planFoodSearch(term);
  const request = async (query: string) => {
    // Basic OAuth supports foods.search; newer food search versions
    // require premier scope not guaranteed by a Basic account.
    const body = new URLSearchParams({
      method: "foods.search",
      search_expression: query,
      max_results: "40",
      format: "json",
    });
    const response = await fetch("https://platform.fatsecret.com/rest/server.api", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) throw Error("FatSecret HTTP " + response.status);
    const data = await response.json();
    if (data?.error) {
      const code = Number(data.error?.code || 0);
      if (code === 13 || code === 14) throw Error("FatSecret authentication/access " + code);
      throw Error("FatSecret API error");
    }
    let items = data?.foods?.food ?? [];
    if (!Array.isArray(items)) items = [items];
    return items.filter((f: any) => f?.food_id).map((f: any) => ({
      name: cap(f.food_name), brand: cap(f.brand_name,120),
      source: "fatsecret", source_id: cap(f.food_id,100),
      serving_label: "", description: cap(f.food_description,250),
      source_url: String(f.food_url??"").startsWith("https://foods.fatsecret.com/")
        ?cap(f.food_url,400):"",
      can_log: false,
    }));
  };
  const broad = plan.restaurant || term;
  const detailed = plan.restaurant && plan.itemTerms.length
    ? plan.restaurant + " " + plan.itemTerms.join(" ") : broad;
  let foods = await request(detailed);
  if (plan.restaurant) foods = foods.filter((food: any) => restaurantMatches(food,plan));
  if (plan.restaurant && plan.itemTerms.length && !foods.length) {
    foods = (await request(broad)).filter((food: any) => restaurantMatches(food,plan));
  }
  return { status: "ok", foods };
};
const providerFailure = (error: unknown): "authentication_failed" | "access_denied" |
    "rate_limited" | "network_error" | "unavailable" => {
  const message = String(error instanceof Error ? error.message : error);
  if (/403|scope|permission|authentication\/access 14/i.test(message)) return "access_denied";
  if (/401|auth|invalid token/i.test(message)) return "authentication_failed";
  if (/429|rate|limit/i.test(message)) return "rate_limited";
  if (/timeout|fetch|network|connect/i.test(message)) return "network_error";
  return "unavailable";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "Method not allowed" });
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return reply(req, 403, { error: "Origin not allowed" });
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return reply(req, 401, { error: "Please sign in" });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY") ||
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")["default"];
    if (!url || !key) return reply(req, 503, { error: "Authentication configuration unavailable" });
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(jwt);
    if (error || !data.user?.id) return reply(req, 401, { error: "Sign in to search foods" });
    if (!takeSlot(data.user.id)) return reply(req, 429, { error: "Too many searches. Try again in a minute." });
    let payload: any;
    try { payload = await req.json(); }
    catch { return reply(req, 400, { error: "Invalid request" }); }
    if (payload?.action === "details") {
      const fdcId = String(payload?.fdcId || "");
      if (!/^[0-9]{1,12}$/.test(fdcId)) return reply(req, 400, { error: "Invalid USDA food identifier" });
      try { return reply(req, 200, { food: await queryUsdaDetails(fdcId) }); }
      catch { return reply(req, 503, { error: "USDA serving details unavailable" }); }
    }
    const query = String(payload?.query || "").trim();
    if (query.length < 2 || query.length > 80) return reply(req, 400, { error: "Food search must be 2–80 characters" });
    const [usda, fatsecret] = await Promise.allSettled([queryUsda(query), queryFatSecret(query)]);
    const usdaResult = usda.status === "fulfilled" ? usda.value : { status: providerFailure(usda.reason), foods: [] };
    const fatsecretResult = fatsecret.status === "fulfilled" ? fatsecret.value : { status: providerFailure(fatsecret.reason), foods: [] };
    return reply(req, 200, {
      usda: usdaResult.foods,
      fatsecret: fatsecretResult.foods,
      providers: { usda: usdaResult.status, fatsecret: fatsecretResult.status },
    });
  } catch {
    return reply(req, 503, { error: "Food search temporarily unavailable" });
  }
});
