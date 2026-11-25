// Shared food search planning. Pure JS for browser, Edge Function, and regression tests.
// Restaurant aliases are explicit to avoid confusing Marco's Pizza with San Marcos.
export const normalizeFoodText=value=>String(value||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
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
const BASIC=new Set([
  'egg','eggs','chicken','chicken breast','rice','banana','apple','milk',
  'oatmeal','oats','beef','ground beef','salmon','potato','potatoes','broccoli',
  'turkey','egg white','egg whites','bread','pasta','yogurt'
]);
const trimAlias=query=>{
  for(const restaurant of CHAINS){
    for(const alias of restaurant.aliases.sort((a,b)=>b.length-a.length)){
      if(query===alias||query.startsWith(alias+' '))return {restaurant,alias,
        remainder:query.slice(alias.length).trim()};
    }
  }
  return null;
};
export function planFoodSearch(input){
  const original=String(input||'').trim().slice(0,80);
  const norm=normalizeFoodText(original);
  const eggQuery=norm==='egg'||norm==='eggs';
  const found=trimAlias(norm);
  return {
    original,normalized:eggQuery?'egg':norm,
    restaurant:found?.restaurant?.name||'',
    restaurantAliases:found?.restaurant?.aliases||[],
    itemTerms:found?.remainder?found.remainder.split(' ').filter(Boolean):[],
    providerQuery:found?.restaurant?.name||(eggQuery?'eggs':original),
    // Two established USDA queries retrieve plain eggs that can be absent
    // from the first page of the broader food listing.
    usdaQueries:eggQuery?['eggs','egg, whole, raw']:[found?.restaurant?.name||original],
    // If a specific restaurant menu item isn't in the provider results, show
    // restaurant results separately and never pretend they match the full phrase.
    broadened:!!found?.remainder,
    common:!found&&BASIC.has(norm),
  };
}
const wordMatch=(target,term)=>{
  const words=target.split(' ').filter(Boolean);
  const basic=term.length<=3;
  const root=term.length>3&&term.endsWith('s')?term.slice(0,-1):term;
  return words.some(w=>{
    const sw=w.length>3&&w.endsWith('s')?w.slice(0,-1):w;
    if(basic)return sw===root;
    return sw===root||sw.startsWith(root)||(root==='burger'&&sw.endsWith('burger'));
  });
};
export function restaurantMatches(food,plan){
  if(!plan?.restaurant)return false;
  const brand=normalizeFoodText(food?.brand);
  const name=normalizeFoodText(food?.name);
  return plan.restaurantAliases.some(alias=>
    brand===alias||brand.startsWith(alias+' ')||name===alias||name.startsWith(alias+' '));
}
export function rankFoodMatch(food,query){
  const plan=typeof query==='string'?planFoodSearch(query):query;
  const name=normalizeFoodText(food?.name),brand=normalizeFoodText(food?.brand);
  if(!name||!plan?.normalized)return -1;
  if(plan.restaurant){
    if(!restaurantMatches(food,plan))return -1;
    const itemMatches=plan.itemTerms.length>0&&plan.itemTerms.every(term=>
      wordMatch(name,term)||wordMatch(brand,term));
    const score=150+(itemMatches?100:0)+
      (food.source==='fatsecret'?10:0)+
      (name===normalizeFoodText(plan.restaurant)?20:0);
    return score;
  }
  const tokens=plan.normalized.split(' ').filter(Boolean);
  if(!tokens.every(term=>wordMatch(name,term)||wordMatch(brand,term)))return -1;
  let score=12+tokens.length*4;
  if(name===plan.normalized)score+=130;
  else if(name.startsWith(plan.normalized+' '))score+=76;
  else if(brand===plan.normalized)score+=55;
  else if(name.includes(plan.normalized))score+=35;
  if(plan.common){
    // A search for plain "egg" or "eggs" should lead with whole/raw eggs,
    // not egg burritos or prepared omelets. Do not invent food records:
    // only rank returned, source-attributed products.
    if(plan.normalized==='egg'){
      if(/^eggs?\s+(whole|raw|fresh|grade|large|medium|small|in shell)\b/.test(name))score+=155;
      else if(/^eggs?\s+(boiled|hard boiled|soft boiled|poached)\b/.test(name))score+=95;
      else if(/^eggs?\s+(omelet|omelette|burrito|sandwich|wrap|scrambled)\b/.test(name))score-=55;
    }
    const type=String(food.data_type||'');
    if(food.source==='usda'&&type!=='Branded')score+=120;
    else if(food.source==='usda'&&type==='Branded')score-=45;
    else if(food.source==='openfoodfacts')score-=30;
    else if(food.source==='fatsecret')score-=30;
    if(brand&&brand!=='')score-=20;
  }
  if(food.source==='usda'){
    if(food.data_type==='Foundation')score+=14;
    else if(food.data_type==='SR Legacy')score+=12;
    else if(food.data_type==='Survey (FNDDS)')score+=10;
  }
  if(food.can_log===false)score-=5;
  // Relevant branded foods stay discoverable, but never outrank ordinary eggs.
  return Math.max(1,score);
}
