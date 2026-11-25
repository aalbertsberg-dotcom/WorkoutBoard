import {searchFoodCatalog} from './nutritionCatalog.js';
import {normalizeFoodText,planFoodSearch,rankFoodMatch} from '../supabase/functions/nutrition-search/foodSearchPlan.js';

const keyFor=food=>food?.source==='fatsecret'
  ?'fatsecret:'+food.source_id
  :normalizeFoodText(food?.name)+'|'+normalizeFoodText(food?.brand)+'|'+String(food?.serving_label||'');
const sourceRank={usda:0,openfoodfacts:1,fatsecret:2};
export const foodSourceLabel=food=>{
  switch(food?.source){
    case 'usda':return food.can_log===false?'USDA · Needs verification':food.data_type==='Branded'?'USDA · Branded food':'USDA · Common food';
    case 'fatsecret':return 'FatSecret · Restaurant/brand preview';
    case 'openfoodfacts':return 'Open Food Facts · Packaged food';
    default:return food?.source||'Custom food';
  }
};
export const foodRelevance=(food,query)=>rankFoodMatch(food,query);
export function mergeFoodResults(groups,query=''){
  const seen=new Set(),found=[];
  const plan=planFoodSearch(query);
  for(const source of ['usda','openfoodfacts','fatsecret']){
    for(const food of groups[source]||[]){
      if(!food?.name)continue;
      const key=keyFor(food);
      if(seen.has(key))continue;
      const rank=query?rankFoodMatch(food,plan):0;
      if(rank<0)continue;
      seen.add(key);
      found.push({food,rank});
    }
  }
  if(query)found.sort((a,b)=>b.rank-a.rank
    ||(sourceRank[a.food.source]??3)-(sourceRank[b.food.source]??3)
    ||a.food.name.localeCompare(b.food.name));
  return found.slice(0,70).map(x=>x.food);
}
export async function searchAllFoodCatalog(query,{
  supabaseClient,searchPackaged=searchFoodCatalog,onResults,onDiagnostics
}={}){
  const value=String(query||'').trim();
  if(value.length<2)throw new Error('Enter at least two characters.');
  const groups={usda:[],openfoodfacts:[],fatsecret:[]};
  const states={usda:'not_configured',fatsecret:'not_configured',packaged:'unavailable'};
  let successes=0;
  const errors=[];
  const backend=async()=>{
    if(!supabaseClient||typeof navigator!=='undefined'&&navigator.onLine===false)return;
    const {data,error}=await supabaseClient.functions.invoke('nutrition-search',{body:{query:value}});
    if(error)throw error;
    if(!data||typeof data!=='object'||!data.providers)throw Error('Nutrition search service response invalid.');
    groups.usda=Array.isArray(data.usda)?data.usda.filter(food=>food?.source==='usda'&&typeof food.can_log==='boolean'):[];
    // FatSecret data remain live ephemeral previews; never include in favorites or logs.
    groups.fatsecret=Array.isArray(data.fatsecret)
      ?data.fatsecret.filter(food=>food.source==='fatsecret'&&food.can_log===false):[];
    states.usda=String(data.providers.usda||'unavailable');
    states.fatsecret=String(data.providers.fatsecret||'unavailable');
    if(states.usda==='ok'||states.fatsecret==='ok')successes++;
  };
  const packaged=async()=>{
    groups.openfoodfacts=await searchPackaged(value);
    if(!Array.isArray(groups.openfoodfacts))groups.openfoodfacts=[];
    states.packaged='ok';
    successes++;
  };
  // A single sorted batch protects users from moving cards under their finger.
  const settled=await Promise.allSettled([backend(),packaged()]);
  if(settled[0].status==='rejected'){errors.push(settled[0].reason);states.usda='unavailable';states.fatsecret='unavailable';}
  if(settled[1].status==='rejected'){errors.push(settled[1].reason);states.packaged='unavailable';}
  const foods=mergeFoodResults(groups,value);
  const plan=planFoodSearch(value);
  const itemMatches=plan.restaurant&&plan.itemTerms.length>0
    ?foods.some(food=>plan.itemTerms.every(term=>rankFoodMatch(food,{
      ...plan,restaurant:'',normalized:term
    })>=0)):false;
  const diagnostic={
    ...states,restaurant:plan.restaurant,broadened:Boolean(plan.broadened&&!itemMatches),
    hasMatches:foods.length>0,
  };
  if(typeof onDiagnostics==='function')onDiagnostics(diagnostic);
  if(foods.length||successes){
    if(typeof onResults==='function')onResults(foods);
    return foods;
  }
  throw new Error(errors[0]?.message||'Food search unavailable. Saved and custom foods still work.');
}
