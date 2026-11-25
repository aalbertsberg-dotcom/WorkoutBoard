import {normalizeOpenFoodFacts} from './nutritionModel.js';

// Open Food Facts: full-text product search is ONLY supported by the legacy
// /cgi/search.pl endpoint. /api/v2/search does not support search_terms.
// Queries are user-triggered to respect provider rate limits.
const FIELDS='code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
const ROOT='https://world.openfoodfacts.org';
const US_ROOT='https://us.openfoodfacts.org';
const MAX_RESULTS=24;
const simplify=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const words=value=>simplify(value).split(' ').filter(Boolean);
const keyFor=food=>String(food.barcode||'')||simplify(food.name+' '+food.brand+' '+food.serving_label);

export function scoreFoodMatch(food,query){
  const q=simplify(query),name=simplify(food?.name),brand=simplify(food?.brand);
  if(!q||!name)return -1;
  const target=name+' '+brand;
  const terms=words(query).filter(x=>x.length>1);
  if(!terms.length||!terms.every(term=>target.includes(term)))return -1;
  if(name===q)return 100;
  if(name.startsWith(q+' '))return 90;
  if(name.includes(q))return 80;
  if(brand.includes(q))return 60;
  return 40;
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
async function request(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'},credentials:'omit'});
    if(response.status===429)throw new Error('Food search is temporarily rate-limited. Please try again later.');
    if(!response.ok)throw new Error('Food catalog is unavailable (HTTP '+response.status+').');
    const reply=await response.json();
    if(!reply||typeof reply!=='object')throw new Error('Food catalog returned an invalid response.');
    return reply;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Food search timed out. Try again on a stable connection.');
    throw error;
  }finally{clearTimeout(timer);}
}
function offline(){return typeof navigator!=='undefined'&&navigator.onLine===false;}
function toSearchError(error){
  if(error instanceof TypeError||/Failed to fetch|NetworkError|Load failed/i.test(String(error?.message||'')))
    return new Error('Could not reach Open Food Facts. Check your connection and try again; you can still add a custom food.');
  return error;
}
export async function searchFoodCatalog(terms){
  const value=String(terms||'').trim();
  if(value.length<2)throw new Error('Enter at least two characters.');
  if(offline())throw new Error('Food search needs a connection. Saved and custom foods work offline.');
  let error=null,gotResponse=false;
  // World catalog first for broad coverage, then US server if unavailable
  // or if no matching nutrition records are found.
  for(const base of [ROOT,US_ROOT]){
    try{
      const reply=await request(foodSearchUrl(value,{base}));
      if(!Array.isArray(reply.products))throw new Error('Food catalog returned no usable search results.');
      gotResponse=true;
      const matches=rankFoodProducts(reply.products,value);
      if(matches.length)return matches;
    }catch(e){
      error=toSearchError(e);
      if(/rate-limited/.test(error.message))throw error;
    }
  }
  if(error&&!gotResponse)throw error;
  return [];
}
export async function lookupFoodBarcode(barcode){
  const code=String(barcode||'').replace(/\s+/g,'');
  if(!/^[0-9]{8,14}$/.test(code))throw new Error('Enter an 8–14 digit product barcode.');
  if(offline())throw new Error('Barcode lookup requires a connection.');
  try{
    const reply=await request(ROOT+'/api/v2/product/'+code+'.json?fields='+encodeURIComponent(FIELDS));
    const food=reply.status===1?normalizeOpenFoodFacts(reply.product):null;
    if(!food)throw new Error('Product not found or nutrition data is missing. You can enter it manually.');
    return food;
  }catch(error){throw toSearchError(error);}
}
