import {searchFoodCatalog} from './nutritionCatalog.js';

// Compare each provider's returned records with the submitted query.
// Searching "Marco's Pizza" must not display Pizza Hut or unrelated pizza.
const normalizeText=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const stem=value=>value.length>3&&value.endsWith('s')&&!value.endsWith('ss')?value.slice(0,-1):value;
const queryKey=food=>food?.source==='fatsecret'
  ?'fatsecret:'+food.source_id
  :normalizeText(food?.name)+'|'+normalizeText(food?.brand)+'|'+String(food?.serving_label||'');
const sourceRank={usda:0,openfoodfacts:1,fatsecret:2};
export const foodSourceLabel=food=>{
  switch(food?.source){
    case 'usda':return food.data_type==='Branded'?'USDA · Branded food':'USDA · Common food';
    case 'fatsecret':return 'FatSecret · Restaurant/brand preview';
    case 'openfoodfacts':return 'Open Food Facts · Packaged food';
    default:return food?.source||'Custom food';
  }
};
export function foodRelevance(food,query){
  const phrase=normalizeText(query);
  if(!phrase)return -1;
  const name=normalizeText(food?.name),brand=normalizeText(food?.brand);
  if(!name)return -1;
  const target=name+' '+brand;
  const tokens=phrase.split(' ').filter(Boolean).map(stem);
  const words=target.split(' ').filter(Boolean).map(stem);
  if(!tokens.every(q=>words.some(w=>w.includes(q)||(q.includes(w)&&w.length>=3))))return -1;
  let score=10+tokens.length*4;
  if(name===phrase||brand===phrase)score+=120;
  else if(name.startsWith(phrase)||brand.startsWith(phrase))score+=75;
  else if(name.includes(phrase)||brand.includes(phrase))score+=50;
  if(food.source==='fatsecret'&&brand.includes(phrase))score+=25;
  if(food.source==='usda'&&food.data_type==='Foundation')score+=3;
  return score;
}
export function mergeFoodResults(groups,query=''){
  const seen=new Set();
  const merged=[];
  for(const source of ['usda','openfoodfacts','fatsecret']){
    for(const food of groups[source]||[]){
      if(!food?.name)continue;
      const key=queryKey(food);
      if(seen.has(key))continue;
      const rank=query?foodRelevance(food,query):0;
      if(rank<0)continue;
      seen.add(key);
      merged.push({food,rank});
    }
  }
  if(query)merged.sort((a,b)=>b.rank-a.rank
    ||(sourceRank[a.food.source]??3)-(sourceRank[b.food.source]??3)
    ||a.food.name.localeCompare(b.food.name));
  return merged.slice(0,70).map(x=>x.food);
}
export async function searchAllFoodCatalog(query,{supabaseClient,searchPackaged=searchFoodCatalog,onResults}={}){
  const value=String(query||'').trim();
  if(value.length<2)throw new Error('Enter at least two characters.');
  const groups={usda:[],openfoodfacts:[],fatsecret:[]};
  let successes=0;
  const errors=[];
  const backend=async()=>{
    if(!supabaseClient||typeof navigator!=='undefined'&&navigator.onLine===false)return;
    const {data,error}=await supabaseClient.functions.invoke('nutrition-search',{body:{query:value}});
    if(error)throw error;
    if(!data||typeof data!=='object'||!data.providers)throw Error('Nutrition search service response invalid.');
    groups.usda=Array.isArray(data.usda)?data.usda.filter(food=>food.can_log===true):[];
    // Provider previews have no loggable macro values under the standard terms.
    groups.fatsecret=Array.isArray(data.fatsecret)
      ?data.fatsecret.filter(food=>food.source==='fatsecret'&&food.can_log===false):[];
    if(data.providers.usda==='ok'||data.providers.fatsecret==='ok')successes++;
  };
  const packaged=async()=>{
    const result=await searchPackaged(value);
    groups.openfoodfacts=Array.isArray(result)?result:[];
    successes++;
  };
  // Wait for all sources before publishing ONCE. Publishing partial results caused
  // a live list to reorder under a user's finger as providers completed.
  const states=await Promise.allSettled([backend(),packaged()]);
  for(const state of states)if(state.status==='rejected')errors.push(state.reason);
  const foods=mergeFoodResults(groups,value);
  if(foods.length||successes){
    if(typeof onResults==='function')onResults(foods);
    return foods;
  }
  throw new Error(errors[0]?.message||'Food search unavailable. Saved and custom foods still work.');
}
