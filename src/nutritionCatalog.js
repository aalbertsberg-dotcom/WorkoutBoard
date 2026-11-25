import {normalizeOpenFoodFacts} from './nutritionModel.js';
import {canonicalFoodText,pluralFoodPhrase,rankFoodMatch} from '../supabase/functions/nutrition-search/foodSearchPlan.js';

// User-triggered public product searches. Search-a-licious is Open Food Facts'
// dedicated full-text service. The legacy keyword endpoint remains a fallback.
// Product searches are not performed on every keystroke (rate-limit friendly).
const FIELDS='code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
const ROOT='https://world.openfoodfacts.org';
const US_ROOT='https://us.openfoodfacts.org';
const SEARCH_ROOT='https://search.openfoodfacts.org';
const MAX_RESULTS=24;
// v2 invalidates older substring-ranked results that mixed apples with pineapple.
const CACHE_KEY='workset-public-food-search-v2';
const CACHE_TTL=7*24*60*60*1000;
const CACHE_LIMIT=16;
const memoryCache=new Map();

const simplify=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const words=value=>simplify(value).split(' ').filter(Boolean);
const keyFor=food=>String(food.barcode||'')||simplify(food.name+' '+food.brand+' '+food.serving_label);
const isOffline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;

export function scoreFoodMatch(food,query){
  return rankFoodMatch({...food,source:'openfoodfacts'},query);
}
export function rankFoodProducts(products,query){
  const seen=new Set();
  return (Array.isArray(products)?products:[])
    .map(normalizeOpenFoodFacts).filter(Boolean)
    .map(food=>({food,score:scoreFoodMatch(food,query)}))
    .filter(item=>item.score>=0)
    .sort((a,b)=>b.score-a.score||Number(a.food.incomplete)-Number(b.food.incomplete)
      ||a.food.name.localeCompare(b.food.name))
    .map(({food})=>food)
    .filter(food=>{const key=keyFor(food);if(seen.has(key))return false;seen.add(key);return true})
    .slice(0,MAX_RESULTS);
}

export function foodSearchUrl(query,{base=ROOT,pageSize=60}={}){
  const url=new URL('/cgi/search.pl',base);
  url.searchParams.set('search_terms',query);
  url.searchParams.set('search_simple','1');
  url.searchParams.set('action','process');
  url.searchParams.set('json','1');
  url.searchParams.set('page_size',String(pageSize));
  url.searchParams.set('fields',FIELDS);
  return url.toString();
}
export function searchALiciousUrl(query,{base=SEARCH_ROOT,pageSize=60}={}){
  const url=new URL('/search',base);
  url.searchParams.set('q',query);
  url.searchParams.set('page_size',String(pageSize));
  url.searchParams.set('fields',FIELDS);
  url.searchParams.set('boost_phrase','true');
  return url.toString();
}
export function searchALiciousProducts(reply){
  if(!Array.isArray(reply?.hits))throw new Error('Search service returned an invalid response.');
  return reply.hits.map(item=>item?._source||item?.document||item?.product||item).filter(Boolean);
}

function loadCache(){
  try{
    const stored=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');
    if(Array.isArray(stored)){
      for(const row of stored){
        if(typeof row?.query==='string'&&Number.isFinite(row.savedAt)&&Array.isArray(row.foods)&&
          Date.now()-row.savedAt<CACHE_TTL)memoryCache.set(row.query,row);
      }
    }
  }catch{}
}
function cached(query){
  if(!memoryCache.size)loadCache();
  const row=memoryCache.get(canonicalFoodText(query));
  if(!row||Date.now()-row.savedAt>=CACHE_TTL||!Array.isArray(row.foods)||!row.foods.length)return null;
  return row.foods.map(food=>({...food,cached:true}));
}
function remember(query,foods){
  if(!foods.length)return;
  const key=canonicalFoodText(query);
  memoryCache.delete(key);
  memoryCache.set(key,{query:key,savedAt:Date.now(),foods});
  while(memoryCache.size>CACHE_LIMIT)memoryCache.delete(memoryCache.keys().next().value);
  try{localStorage.setItem(CACHE_KEY,JSON.stringify([...memoryCache.values()]));}catch{}
}
async function request(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'},credentials:'omit'});
    if(response.status===429)throw new Error('Food service rate limit reached. Try again later.');
    if(!response.ok)throw new Error('Food catalog temporarily unavailable (HTTP '+response.status+').');
    const reply=await response.json();
    if(!reply||typeof reply!=='object')throw new Error('Food service returned an invalid response.');
    return reply;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Food service took too long to respond.');
    throw error;
  }finally{clearTimeout(timer);}
}
function toSearchError(error){
  if(error instanceof TypeError||/Failed to fetch|NetworkError|Load failed/i.test(String(error?.message||'')))
    return new Error('Could not connect to a food database. Try again or log a saved/custom food.');
  return error;
}

export async function searchFoodCatalog(terms){
  const value=String(terms||'').trim();
  if(value.length<2)throw new Error('Enter at least two characters.');
  const previous=cached(value);
  if(isOffline()){
    if(previous)return previous;
    throw new Error('Food search needs a connection. Saved, custom and previously searched foods work offline.');
  }
  // Cache hits are returned without extra API calls, respecting the 10/minute
  // public search limit and making repeated common searches reliable.
  if(previous)return previous;
  let lastError=null,receivedResponse=false;
  const preferred=canonicalFoodText(value);
  const sources=[
    {name:'dedicated',url:searchALiciousUrl(preferred),extract:searchALiciousProducts},
    {name:'world',url:foodSearchUrl(preferred),extract:reply=>{
      if(!Array.isArray(reply.products))throw new Error('Invalid food search response.');
      return reply.products;
    }},
    {name:'us',url:foodSearchUrl(preferred,{base:US_ROOT}),extract:reply=>{
      if(!Array.isArray(reply.products))throw new Error('Invalid food search response.');
      return reply.products;
    }}
  ];
  for(const source of sources){
    try{
      const result=await request(source.url);
      const foods=source.extract(result);
      receivedResponse=true;
      const matches=rankFoodProducts(foods,value);
      if(matches.length){remember(value,matches);return matches;}
    }catch(error){
      lastError=toSearchError(error);
      // Never work around an explicit provider rate limit with more requests.
      if(/rate limit/i.test(String(lastError.message)))break;
    }
  }
  // A pluralized follow-up helps catalogs that index only the packaged
  // label form ("eggs", "berries"). It runs only when every primary lookup
  // returned zero valid matches, avoiding unnecessary requests/rate limits.
  const alternate=pluralFoodPhrase(preferred);
  if(alternate && alternate!==preferred && !/rate limit/i.test(String(lastError?.message||''))){
    try{
      const reply=await request(searchALiciousUrl(alternate));
      receivedResponse=true;
      const foods=rankFoodProducts(searchALiciousProducts(reply),value);
      if(foods.length){remember(value,foods);return foods}
    }catch(error){lastError=toSearchError(error)}
  }
  if(receivedResponse)return [];
  throw lastError||new Error('Food databases are currently unavailable. You can still add a custom food.');
}

export async function lookupFoodBarcode(barcode){
  const code=String(barcode||'').replace(/\s+/g,'');
  if(!/^[0-9]{8,14}$/.test(code))throw new Error('Enter an 8–14 digit product barcode.');
  if(isOffline())throw new Error('Barcode lookup requires a connection.');
  try{
    const reply=await request(ROOT+'/api/v2/product/'+code+'.json?fields='+encodeURIComponent(FIELDS));
    const food=reply.status===1?normalizeOpenFoodFacts(reply.product):null;
    if(!food)throw new Error('Product not found or nutrition data is missing. You can enter it manually.');
    return food;
  }catch(error){throw toSearchError(error);}
}
