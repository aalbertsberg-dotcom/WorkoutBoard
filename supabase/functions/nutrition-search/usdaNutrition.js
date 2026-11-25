// Shared, testable FoodData Central search-record normalizer.
// FoodData Central nutrient totals are per 100g; portion weights are data-type
// dependent. Never invent household portions or silently reinterpret kcal as kJ.
const num=x=>(x===null||x===undefined||x==='')?null:(Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null);
const r1=x=>Math.round(x*10)/10;
const cap=(s,n=180)=>String(s??'').slice(0,n);
const nutrient=(items,ids)=>{
  for(const id of ids){
    const item=items.find(x=>Number(x?.nutrientId??x?.nutrient?.id)===id);
    const value=num(item?.value??item?.amount);
    if(value===null)continue;
    const unit=String(item?.unitName??item?.nutrient?.unitName??'').toLowerCase();
    return {value,unit,id};
  }
  return null;
};
export function usdaNutrients(food){
  const nutrients=Array.isArray(food?.foodNutrients)?food.foodNutrients:[];
  // 1008: Energy kcal (legacy), 2047/2048: Atwater kcal.
  // 1062: Energy kJ. When the unit explicitly says kJ, convert.
  const energy=nutrient(nutrients,[1008,2047,2048,1062]);
  const protein=nutrient(nutrients,[1003]);
  const carbs=nutrient(nutrients,[1005]);
  const fat=nutrient(nutrients,[1004]);
  const unit=energy?.unit|| (energy?.id===1062?'kj':'kcal');
  const calories=energy===null?null:unit.includes('kj')?energy.value/4.184:
    (unit.includes('kcal')||unit==='')?energy.value:null;
  const macroCount=[protein,carbs,fat].filter(Boolean).length;
  const macroEstimate=4*(protein?.value??0)+4*(carbs?.value??0)+9*(fat?.value??0);
  const inaccurate=calories!==null&&macroCount>=2&&macroEstimate>40&&
    (calories>Math.max(80,macroEstimate*1.85)||calories<macroEstimate*.38);
  const valid=calories!==null&&calories<=1000&&macroCount>=2&&!inaccurate;
  return {
    calories:calories===null?0:r1(calories),protein_g:r1(protein?.value??0),
    carbs_g:r1(carbs?.value??0),fat_g:r1(fat?.value??0),
    valid,incomplete:macroCount!==3,reason:
      calories===null?'Energy units or calories missing':
      macroCount<2?'Not enough nutrient information to verify':
      calories>1000||inaccurate?'Calories conflict with other nutrients':'',
  };
}
export function usdaPortions(food){
  const found=[{label:'100 g',grams:100}];
  const add=(label,grams)=>{
    const n=num(grams);const name=cap(label,110).trim();
    if(!name||!n||n>1500)return;
    if(found.some(entry=>Math.abs(entry.grams-n)<.01&&entry.label===name))return;
    found.push({label:name,grams:r1(n)});
  };
  // Branded householdServingFullText is only valid WITH a matching gram quantity.
  const branded=num(food?.servingSize);
  const unit=String(food?.servingSizeUnit||'').trim().toLowerCase();
  if(branded&&unit==='g'){
    add(food?.householdServingFullText||food?.servingSize+' g',branded);
  }
  for(const p of (Array.isArray(food?.foodPortions)?food.foodPortions:[])){
    const grams=num(p?.gramWeight);
    if(!grams)continue;
    const raw=cap(p?.portionDescription||p?.modifier||
      [p?.amount,p?.measureUnit?.name].filter(Boolean).join(' '),100);
    if(raw&&raw!=='undefined')add(raw+(/g\b/i.test(raw)?'':' ('+r1(grams)+' g)'),grams);
  }
  return found;
}
export function normalizeUsdaSearchFood(food){
  const name=cap(food?.description).trim();
  if(!name)return null;
  const nutrients=usdaNutrients(food);
  const portions=usdaPortions(food);
  const branded=num(food?.servingSize);
  const grams=branded&&String(food?.servingSizeUnit||'').toLowerCase()==='g'&&branded<=1500?branded:100;
  const portion=portions.find(x=>Math.abs(x.grams-grams)<.01&&x.label!=='100 g')||portions[0];
  const scale=grams/100;
  return {
    name,brand:cap(food?.brandName||food?.brandOwner||'',120),
    source:'usda',source_id:cap(food?.fdcId,100),
    serving_label:portion?.label||'100 g',
    serving_grams:grams,serving_options:portions,
    calories:r1(nutrients.calories*scale),protein_g:r1(nutrients.protein_g*scale),
    carbs_g:r1(nutrients.carbs_g*scale),fat_g:r1(nutrients.fat_g*scale),
    data_type:cap(food?.dataType,40),
    can_log:nutrients.valid,
    incomplete:nutrients.incomplete,
    validation_warning:nutrients.reason,
  };
}
// Detect historical USDA diary entries likely affected by incorrect API unit
// conversions; never mutate them without the user's review.
export function needsNutritionReview(entry){
  if(entry?.source!=='usda')return false;
  const kcal=num(entry?.calories),p=num(entry?.protein_g),c=num(entry?.carbs_g),f=num(entry?.fat_g);
  if(kcal===null||[p,c,f].some(v=>v===null))return false;
  const macro=4*p+4*c+9*f;
  return macro>40&&(kcal>Math.max(80,macro*1.85)||kcal<macro*.38);
}
