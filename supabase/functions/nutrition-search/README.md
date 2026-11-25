# WorkSet Multi-Source Nutrition Search

## Edge Function secrets
Configure these using Supabase Dashboard > Edge Functions > Secrets, never GitHub or browser build variables:

- WORKSET_USDA_API_KEY (USDA FoodData Central)
- WORKSET_FATSECRET_CLIENT_ID (FatSecret OAuth 2.0)
- WORKSET_FATSECRET_CLIENT_SECRET (FatSecret OAuth 2.0)

Rotate the exposed credentials from the screenshots before using them in production. The function reads secrets exclusively through Deno.env.get.

## Behavior and licensing
Signed-in users can search USDA common foods, branded foods, and Open Food Facts products. All loggable foods preserve per-serving calorie and macro values.

FatSecret search returns live previews only. Under its standard Storable Data rules, indefinite storage is permitted for certain IDs, not full nutrient data; therefore its nutrition fields are NOT persisted in WorkSet diaries, favorites, offline caches, or backups. FatSecret results are labeled and link back to the provider. FatSecret Basic and Premier Free require attribution.

Details: https://platform.fatsecret.com/docs/guides/storable-data

Before making FatSecret records loggable, obtain appropriate provider rights or redesign their diary integration around licensed data handling.

## Deployment
Deploy nutrition-search with verify_jwt false because its handler explicitly verifies every caller through Supabase Auth getUser. The function validates CORS origins, limits searches per caller per running isolate, and never exposes provider credentials.

Test USDA search, FatSecret preview, existing packaged-food lookups, calorie totals, and Android/iPhone layouts. Missing secrets result in unconfigured providers and leave Open Food Facts available.
