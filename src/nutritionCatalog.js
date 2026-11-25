import {normalizeOpenFoodFacts} from './nutritionModel.js';

// Open Food Facts search is explicitly user-triggered to respect provider rate limits.
// Network-only search has a manual-entry fallback for offline use.
const FIELDS='code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
const ROOT='https://world.openfoodfacts.org';
async function request(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Food catalog temporarily unavailable ('+response.status+').');
    return response.json();
  }finally{clearTimeout(timer);}
}
export async function searchFoodCatalog(terms){
  const value=String(terms||'').trim();
  if(value.length<2)throw new Error('Enter at least two characters.');
  if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('Food search needs a connection. Saved and custom foods work offline.');
  const url=ROOT+'/api/v2/search?search_terms='+encodeURIComponent(value)
    +'&page_size=20&fields='+encodeURIComponent(FIELDS);
  const reply=await request(url);
  return (reply.products||[]).map(normalizeOpenFoodFacts).filter(Boolean);
}
export async function lookupFoodBarcode(barcode){
  const code=String(barcode||'').replace(/\s+/g,'');
  if(!/^[0-9]{8,14}$/.test(code))throw new Error('Enter an 8–14 digit product barcode.');
  if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('Barcode lookup requires a connection.');
  const reply=await request(ROOT+'/api/v2/product/'+code+'.json?fields='+encodeURIComponent(FIELDS));
  const food=reply.status===1?normalizeOpenFoodFacts(reply.product):null;
  if(!food)throw new Error('Product not found or nutrition data is missing. You can enter it manually.');
  return food;
}
