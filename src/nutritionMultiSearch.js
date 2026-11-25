import {searchFoodCatalog} from './nutritionCatalog.js';

const normalizeText=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const queryKey=food=>food?.source==='fatsecret'
  ?'fatsecret:'+food.source_id
  :normalizeText(food?.name)+'|'+normalizeText(food?.brand)+'|'+String(food?.serving_label||'');
export const foodSourceLabel=food=>{
  switch(food?.source){
    case 'usda':return food.data_type==='Branded'?'USDA · Branded food':'USDA · Common food';
    case 'fatsecret':return 'FatSecret · Restaurant/brand preview';
    case 'openfoodfacts':return 'Open Food Facts · Packaged food';
    default:return food?.source||'Custom food';
  }
};
export function mergeFoodResults(groups){
  const seen=new Set();
  const merged=[];
  const order=['usda','openfoodfacts','fatsecret'];
  for(const source of order){
    for(const food of groups[source]||[]){
      if(!food?.name)continue;
      const key=queryKey(food);
      if(seen.has(key))continue;
      seen.add(key);
      merged.push(food);
    }
  }
  return merged.slice(0,70);
}
export function searchAllFoodCatalog(query,{supabaseClient,searchPackaged=searchFoodCatalog,onResults}={}){
  const value=String(query||'').trim();
  if(value.length<2)return Promise.reject(new Error('Enter at least two characters.'));
  const groups={usda:[],openfoodfacts:[],fatsecret:[]};
  let successes=0;
  const errors=[];
  const publish=()=>{
    const result=mergeFoodResults(groups);
    if(typeof onResults==='function')onResults(result);
  };
  const backend=async()=>{
    if(!supabaseClient||typeof navigator!=='undefined'&&navigator.onLine===false)return;
    const {data,error}=await supabaseClient.functions.invoke('nutrition-search',{body:{query:value}});
    if(error)throw error;
    if(!data||typeof data!=='object'||!data.providers)throw Error('Nutrition search service response invalid.');
    groups.usda=Array.isArray(data.usda)?data.usda.filter(food=>food.can_log===true):[];
    // FatSecret nutrition may not be saved under its standard storage terms.
    groups.fatsecret=Array.isArray(data.fatsecret)
      ?data.fatsecret.filter(food=>food.source==='fatsecret'&&food.can_log===false):[];
    if(data.providers.usda==='ok'||data.providers.fatsecret==='ok')successes++;
    publish();
  };
  const packaged=async()=>{
    const result=await searchPackaged(value);
    groups.openfoodfacts=Array.isArray(result)?result:[];
    successes++;
    publish();
  };
  return Promise.allSettled([backend(),packaged()]).then(states=>{
    for(const state of states)if(state.status==='rejected')errors.push(state.reason);
    const foods=mergeFoodResults(groups);
    if(foods.length||successes)return foods;
    throw new Error(errors[0]?.message||'Food search unavailable. Saved and custom foods still work.');
  });
}
