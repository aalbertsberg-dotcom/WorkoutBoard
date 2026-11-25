// Shared food query normalization and ranking for the browser and Supabase.
// Linguistic rules apply to ALL foods; no keyword-specific search fixes.
export const normalizeFoodText=value=>String(value||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');

const IRREGULAR=new Map(Object.entries({
  children:'child',people:'person',men:'man',women:'woman',teeth:'tooth',
  feet:'foot',geese:'goose',mice:'mouse',leaves:'leaf',knives:'knife'
}));
const KEEP_IE=new Set(['cookies','brownies','smoothies','pies','calories']);
export function singularFoodWord(value){
  const word=String(value||'').toLowerCase();
  if(IRREGULAR.has(word))return IRREGULAR.get(word);
  if(word.length<4)return word;
  if(word.endsWith('ies')&&word.length>4)
    return KEEP_IE.has(word)?word.slice(0,-1):word.slice(0,-3)+'y';
  if(/(?:ches|shes|sses|zzes|xes)$/.test(word))return word.slice(0,-2);
  if(word.endsWith('oes')&&!['shoes'].includes(word))return word.slice(0,-2);
  if(word.endsWith('s')&&!/(?:ss|us|is)$/.test(word))return word.slice(0,-1);
  return word;
}
export const canonicalFoodText=value=>normalizeFoodText(value)
  .split(' ').filter(Boolean).map(singularFoodWord).join(' ');
const CHAINS=[
  {name:"Marco's Pizza",aliases:["marcos pizza","marcos","marco pizza"]},
  {name:"Chick-fil-A",aliases:["chick fil a","chickfila","chick fil a restaurant"]},
  {name:"Waffle House",aliases:["waffle house"]},
  {name:"McDonald's",aliases:["mcdonalds","mcdonald"]},
  {name:"Taco Bell",aliases:["taco bell"]},
  {name:"Burger King",aliases:["burger king"]},
  {name:"Wendy's",aliases:["wendys"]},
  {name:"Subway",aliases:["subway"]},
];
const chains=CHAINS.map(row=>({...row,normalized:row.aliases.map(normalizeFoodText)
  .sort((a,b)=>b.length-a.length)}));
const detectRestaurant=query=>{
  for(const chain of chains){
    for(const alias of chain.normalized){
      if(query===alias||query.startsWith(alias+' ')){
        return {restaurant:chain.name,aliases:chain.normalized,
          remainder:query.slice(alias.length).trim()};
      }
    }
  }
  return null;
};
export function planFoodSearch(input){
  const original=String(input||'').trim().slice(0,80);
  const raw=normalizeFoodText(original);
  const found=detectRestaurant(raw);
  const normalized=canonicalFoodText(original);
  const itemTerms=found?.remainder?canonicalFoodText(found.remainder).split(' ').filter(Boolean):[];
  const common=!found&&normalized.split(' ').length<=2;
  const providerQuery=found?.restaurant
    ?found.restaurant+(itemTerms.length?' '+itemTerms.join(' '):''):normalized;
  // Two bounded, general-purpose queries for ingredients. "Apple"/"Apples",
  // "Egg"/"Eggs", "Berry"/"Berries" are planned identically.
  const usdaQueries=found
    ?[providerQuery,found.restaurant]
    :common?[normalized,normalized+', raw']:[normalized];
  return {
    original,normalized,restaurant:found?.restaurant||'',
    restaurantAliases:found?.aliases||[],itemTerms,
    providerQuery,usdaQueries:[...new Set(usdaQueries)],
    common,broadened:Boolean(found&&itemTerms.length),
  };
}
const tokens=value=>canonicalFoodText(value).split(' ').filter(Boolean);
const tokenMatches=(word,term)=>{
  if(word===term)return true;
  // "burger" should also find "cheeseburger", but "egg" must not
  // match "eggplant". Broad partials are only allowed for longer terms.
  // Conservative semantic compounds only: pineapple is NOT an apple, and
  // grapefruit is NOT a grape. Generic inflection never relies on substring.
  const compoundClasses=['burger','berry','bread'];
  if(compoundClasses.includes(term)&&word.length>term.length&&word.endsWith(term))return true;
  return false;
};
const allTermsMatch=(words,terms)=>terms.every(term=>words.some(w=>tokenMatches(w,term)));
export function restaurantMatches(food,plan){
  if(!plan?.restaurant)return false;
  const brand=normalizeFoodText(food?.brand),name=normalizeFoodText(food?.name);
  return plan.restaurantAliases.some(alias=>
    brand===alias||brand.startsWith(alias+' ')||
    name===alias||name.startsWith(alias+' '));
}
export function restaurantItemMatches(food,plan){
  if(!restaurantMatches(food,plan))return false;
  if(!plan.itemTerms.length)return true;
  // Only the item name counts. Never treat a matching restaurant brand as
  // evidence that a waffle mix is a hashbrown bowl.
  const name=normalizeFoodText(food?.name);
  const suffix=plan.restaurantAliases.reduce((rest,alias)=>
    rest===alias||rest.startsWith(alias+' ')?rest.slice(alias.length).trim():rest,name);
  return allTermsMatch(tokens(suffix),plan.itemTerms);
}
export function rankFoodMatch(food,query){
  const plan=typeof query==='string'?planFoodSearch(query):query;
  const name=canonicalFoodText(food?.name),brand=canonicalFoodText(food?.brand);
  if(!name||!plan?.normalized)return -1;
  if(plan.restaurant){
    if(!restaurantItemMatches(food,plan))return -1;
    let score=170;
    if(plan.itemTerms.length)score+=100;
    if(food.source==='fatsecret')score+=8;
    return score;
  }
  const queryWords=tokens(plan.normalized),nameWords=tokens(name),brandWords=tokens(brand);
  if(!allTermsMatch([...nameWords,...brandWords],queryWords))return -1;
  let score=50;
  const inName=allTermsMatch(nameWords,queryWords);
  if(inName)score+=30;
  if(name===plan.normalized)score+=100;
  else if(name.startsWith(plan.normalized+' '))score+=55;
  else if(name.includes(' '+plan.normalized+' '))score+=20;
  if(nameWords[0]===queryWords[0])score+=25;
  if(plan.common&&inName){
    const type=String(food.data_type||'');
    if(food.source==='usda'&&type==='Foundation')score+=160;
    else if(food.source==='usda'&&type==='SR Legacy')score+=125;
    else if(food.source==='usda'&&type==='Survey (FNDDS)')score+=50;
    else if(food.source==='usda'&&type==='Branded')score-=35;
    else if(food.source==='openfoodfacts')score-=25;
    if(!brand)score+=18;
    if(nameWords.includes('raw')||nameWords.includes('whole')||nameWords.includes('fresh'))score+=35;
    score-=Math.min(65,Math.max(0,nameWords.length-queryWords.length)*6);
  }
  if(!inName&&brand)score-=30;
  if(food.can_log===false)score-=6;
  return Math.max(1,score);
}


// FatSecret's documented Basic OAuth search v1 contract; centralized so API
// URL construction is verified independently of live credentials.
export function fatSecretSearchUrl(query,page=0){
  const url=new URL('https://platform.fatsecret.com/rest/foods/search/v1');
  url.searchParams.set('search_expression',String(query||'').trim());
  url.searchParams.set('max_results','50');
  url.searchParams.set('page_number',String(Math.max(0,Math.min(2,Math.floor(Number(page)||0)))));
  url.searchParams.set('format','json');
  return url.toString();
}
