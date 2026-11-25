// WorkSet Food Search Proxy
// USDA and FatSecret credentials must be configured in Supabase Edge Function Secrets.
// NEVER put provider keys or FatSecret tokens into VITE_ variables, logs, git, or client responses.
// FatSecret's storable-data terms permit only food_id / serving_id retention. The
// results returned here are live SEARCH PREVIEWS only and must not be saved to the diary.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { normalizeUsdaSearchFood } from "./usdaNutrition.js";
import { planFoodSearch, rankFoodMatch, restaurantItemMatches, fatSecretSearchUrl } from "./foodSearchPlan.js";

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
  const fetchUsda = async (query: string, commonOnly: boolean) => {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", key);
    const body: Record<string, unknown> = {
      query, pageSize: 60, pageNumber: 1,
    };
    if (commonOnly) body.dataType = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) throw Error("USDA HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data?.foods)) throw Error("USDA response invalid");
    return data.foods.map(normalizeUsdaSearchFood).filter(Boolean);
  };
  const merge = (batches: any[][]) => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const batch of batches) for (const food of batch) {
      const id = String(food.source_id || food.name + "|" + food.brand);
      if (seen.has(id)) continue;
      seen.add(id); result.push(food);
    }
    return result
      .map(food=>({food,rank:rankFoodMatch(food,plan)}))
      .filter(item=>item.rank>=0)
      .sort((a,b)=>b.rank-a.rank)
      .slice(0,90)
      .map(item=>item.food);
  };
  // Search both canonical and plural ingredient forms, plus raw-food
  // variations. Rank before capping so exact ingredients are not crowded
  // out by high-volume generic search results.
  // Also fetch branded USDA matches, regardless of whether generic matches
  // exist, so relevant packaged results are not silently hidden.
  const calls = plan.usdaQueries.map(query=>fetchUsda(query,plan.common));
  if (plan.common) calls.push(fetchUsda(plan.normalized,false));
  const attempts = await Promise.allSettled(calls);
  const batches = attempts.filter((x): x is PromiseFulfilledResult<any[]> =>
    x.status === "fulfilled").map(x=>x.value);
  if (!batches.length) throw (attempts[0] as PromiseRejectedResult).reason;
  return { status: "ok", foods: merge(batches) };
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
  const request = async (query: string,page=0) => {
    // Official Basic-tier v1 GET endpoint; optional page search supports
    // restaurant items buried behind unrelated first-page provider results.
    const url = fatSecretSearchUrl(query,page);
    const response = await fetch(url,{
      method:"GET",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/json" },
      signal:AbortSignal.timeout(8500),
    });
    if(!response.ok)throw Error("FatSecret HTTP "+response.status);
    const data=await response.json();
    if(data?.error){
      const code=Number(data.error?.code||0);
      if(code===13||code===14)throw Error("FatSecret authentication/access "+code);
      throw Error("FatSecret API unavailable");
    }
    let items=data?.foods?.food||[];
    if(!Array.isArray(items))items=[items];
    return {
      total:Math.max(0,Number(data?.foods?.total_results)||0),
      foods:items.filter((food: any)=>food?.food_id).map((food: any)=>({
        name:cap(food.food_name),brand:cap(food.brand_name,120),
        source:"fatsecret",source_id:cap(food.food_id,100),
        serving_label:"",description:cap(food.food_description,250),
        source_url:String(food.food_url||"").startsWith("https://foods.fatsecret.com/")
          ?cap(food.food_url,400):"",
        can_log:false,
      })),
    };
  };
  // First try the requested menu item. Fall back to a restaurant-wide query
  // only to find actual matching items; never return unrelated restaurant food.
  const queries=plan.restaurant&&plan.itemTerms.length
    ?[plan.providerQuery,plan.restaurant]:[plan.providerQuery];
  const seen=new Set<string>();
  const matches=[];
  for(const query of queries){
    const first=await request(query);
    const pages=[first.foods];
    if(plan.restaurant&&plan.itemTerms.length&&first.total>50&&
      !first.foods.some((food: any)=>restaurantItemMatches(food,plan))){
      try{
        const second=await request(query,1);
        pages.push(second.foods);
      }catch{
        // Page 1 results remain valid if the additional provider page fails.
      }
    }
    for(const products of pages)for(const food of products){
      if(plan.restaurant&&!restaurantItemMatches(food,plan))continue;
      if(seen.has(food.source_id))continue;
      seen.add(food.source_id);matches.push(food);
    }
    if(matches.length)break;
  }
  return {status:"ok",foods:matches};
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
    // Only sanitized provider status codes are recorded; never log
    // queries, authentication tokens, user IDs or provider credentials.
    if (usdaResult.status !== "ok" || fatsecretResult.status !== "ok") {
      console.warn("workset-nutrition-provider", JSON.stringify({
        usda: usdaResult.status, fatsecret: fatsecretResult.status,
      }));
    }
    return reply(req, 200, {
      usda: usdaResult.foods,
      fatsecret: fatsecretResult.foods,
      providers: { usda: usdaResult.status, fatsecret: fatsecretResult.status },
    });
  } catch {
    return reply(req, 503, { error: "Food search temporarily unavailable" });
  }
});
