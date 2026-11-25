export const NUTRITION_DEFAULTS = Object.freeze({
  mode:'calories', calorie_goal:2000, protein_goal:150, carbs_goal:200,
  fat_goal:65, water_goal_oz:64
});
export const MEALS = ['Breakfast','Lunch','Dinner','Snacks'];
export const nutrientFields = ['calories','protein_g','carbs_g','fat_g'];
export const round1 = value => Math.round((Number(value)||0)*10)/10;
export const nonnegative = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
export function dateKey(value=new Date()){
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function nutrientSum(items=[]){
  return items.reduce((totals,row)=>{
    for(const field of nutrientFields)totals[field]+=nonnegative(row[field]);
    return totals;
  },{calories:0,protein_g:0,carbs_g:0,fat_g:0});
}
export function multipliedNutrients(food,servings=1){
  const count=Number(servings);
  if(!Number.isFinite(count)||count<=0||count>1000)throw new Error('Choose a valid serving amount (up to 1,000).');
  return Object.fromEntries(nutrientFields.map(field=>[field,round1(nonnegative(food[field])*count)]));
}
export function makeFoodEntry(food,{id,userId,date,meal,servings=1,now=new Date().toISOString()}){
  if(!id||!userId||!date||!MEALS.includes(meal)||!String(food?.name||'').trim())
    throw new Error('Enter a food, date and meal.');
  return {
    id,user_id:userId,entry_date:date,meal,
    name:String(food.name).trim().slice(0,180),brand:String(food.brand||'').slice(0,120),
    serving_label:String(food.serving_label||'1 serving').slice(0,120),
    quantity:Number(servings),...multipliedNutrients(food,servings),
    food_id:food.id||null,source:String(food.source||'manual').slice(0,36),
    source_id:String(food.source_id||'').slice(0,100),created_at:now,updated_at:now,deleted_at:null
  };
}
export function makeWaterEntry({id,userId,date,oz,now=new Date().toISOString()}){
  const amount=Number(oz);
  if(!id||!userId||!date||!Number.isFinite(amount)||amount<=0||amount>256)
    throw new Error('Enter an amount between 0 and 256 oz.');
  return {id,user_id:userId,entry_date:date,amount_oz:round1(amount),
    created_at:now,updated_at:now,deleted_at:null};
}
export function summarizeDay(foodEntries=[],waterEntries=[],date=dateKey()){
  const foods=foodEntries.filter(row=>row.entry_date===date&&!row.deleted_at);
  const water=waterEntries.filter(row=>row.entry_date===date&&!row.deleted_at);
  return { ...nutrientSum(foods),water_oz:round1(water.reduce((total,row)=>total+nonnegative(row.amount_oz),0)),
    meals:foods.length,water_entries:water.length };
}
export function nutritionHistory(foodEntries=[],waterEntries=[],end=dateKey(),days=30){
  const endDate=new Date(end+'T12:00:00');
  return Array.from({length:days},(_,i)=>{
    const date=new Date(endDate); date.setDate(date.getDate()-(days-1-i));
    const key=dateKey(date);
    return {date:key,...summarizeDay(foodEntries,waterEntries,key)};
  });
}
const safeNutrient=(value)=>Number.isFinite(Number(value))?nonnegative(value):null;
export function normalizeOpenFoodFacts(product){
  if(!product||typeof product!=='object')return null;
  const n=product.nutriments||{};
  const serving=Number(product.serving_quantity);
  const hasServing=Number.isFinite(serving)&&serving>0;
  const perServing=field=>{
    const servingValue=safeNutrient(n[field+'_serving']);
    if(hasServing&&servingValue!==null)return servingValue;
    const per100=safeNutrient(n[field+'_100g']);
    if(per100!==null)return per100*(hasServing?serving/100:1);
    return servingValue;
  };
  const cal=perServing('energy-kcal');
  const energy=perServing('energy');
  const calorie=cal!==null?cal:energy!==null?energy/4.184:null;
  const protein=perServing('proteins'),carbs=perServing('carbohydrates'),fat=perServing('fat');
  const name=String(product.product_name||product.product_name_en||'').trim();
  if(!name||[calorie,protein,carbs,fat].every(value=>value===null))return null;
  return {name:name.slice(0,180),brand:String(product.brands||'').slice(0,120),
    source:'openfoodfacts',source_id:String(product.code||''),
    barcode:String(product.code||''),serving_label:hasServing?String(product.serving_size||serving+' g'):'100 g',
    serving_grams:hasServing?serving:100,
    calories:round1(calorie),protein_g:round1(protein),carbs_g:round1(carbs),fat_g:round1(fat),
    incomplete:[calorie,protein,carbs,fat].some(value=>value===null)};
}
export function recipePerServing(ingredients=[],servings=1){
  if(!ingredients.length)throw new Error('Add ingredients first.');
  const count=Number(servings);
  if(!Number.isInteger(count)||count<1||count>100)throw new Error('Recipe servings must be 1–100.');
  const totals=nutrientSum(ingredients);
  return Object.fromEntries(nutrientFields.map(field=>[field,round1(totals[field]/count)]));
}
