import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey,makeFoodEntry,makeWaterEntry,summarizeDay,multipliedNutrients,
  normalizeOpenFoodFacts,recipePerServing,nutritionHistory,foodForPortion,needsNutritionReview,broaderFoodSearch
} from '../src/nutritionModel.js';

const userId='11111111-1111-4111-8111-111111111111', id='22222222-2222-4222-8222-222222222222';
test('food serving multiplication stores calories and all macros',()=>{
  const food={name:'Example',calories:100,protein_g:8,carbs_g:12,fat_g:2};
  const entry=makeFoodEntry(food,{id,userId,date:'2026-11-24',meal:'Lunch',servings:2.5});
  assert.equal(entry.calories,250);assert.equal(entry.protein_g,20);
  assert.equal(entry.carbs_g,30);assert.equal(entry.fat_g,5);
  assert.equal(entry.user_id,userId);
});
test('invalid quantities and hydration amounts never save',()=>{
  assert.throws(()=>multipliedNutrients({calories:5},0));
  assert.throws(()=>makeWaterEntry({id,userId,date:'2026-11-24',oz:-4}));
  assert.throws(()=>makeFoodEntry({name:'Bad'}, {id,userId,date:'2026-11-24',meal:'Unknown'}));
});
test('soft-deleted records are not counted; hydration is independent',()=>{
  const food=makeFoodEntry({name:'Apple',calories:50,carbs_g:14},{id,userId,date:'2026-11-24',meal:'Snacks'});
  const water=makeWaterEntry({id,userId,date:'2026-11-24',oz:16});
  assert.equal(summarizeDay([food],[water],'2026-11-24').water_oz,16);
  assert.equal(summarizeDay([{...food,deleted_at:'2026-11-24T00:00:00Z'}],[], '2026-11-24').calories,0);
});
test('OFF normalization uses serving quantity and prevents fabricated nutrients',()=>{
  const p={product_name:'Rice',code:'12345678',serving_quantity:50,serving_size:'50 g',
    nutriments:{'energy-kcal_100g':200,'proteins_100g':4,'carbohydrates_100g':45,'fat_100g':1}};
  const n=normalizeOpenFoodFacts(p);
  assert.equal(n.calories,100);assert.equal(n.carbs_g,22.5);assert.equal(n.serving_grams,50);
  assert.equal(normalizeOpenFoodFacts({product_name:'Blank',nutriments:{}}),null);
});
test('recipes split ingredient nutrients by the chosen servings',()=>{
  assert.deepEqual(recipePerServing([{calories:400,protein_g:20},{calories:200,protein_g:10}],3),
    {calories:200,protein_g:10,carbs_g:0,fat_g:0});
});
test('history uses local calendar days and keeps days with zero entries',()=>{
  assert.equal(dateKey(new Date(2026,10,24,13)), '2026-11-24');
  const data=nutritionHistory([],[],'2026-11-24',7);
  assert.equal(data.length,7);assert.equal(data.at(-1).date,'2026-11-24');
  assert.equal(data[0].water_oz,0);
});


test('missing nutrition values are flagged instead of treated as measured zeroes',()=>{
  const p={product_name:'Sample',code:'1234567890',serving_quantity:100,
    nutriments:{'energy-kcal_100g':200}};
  const food=normalizeOpenFoodFacts(p);
  assert.equal(food.calories,200);
  assert.equal(food.incomplete,true);
  assert.equal(food.protein_g,0);
  const complete={...p,nutriments:{...p.nutriments,'proteins_100g':0,'carbohydrates_100g':0,'fat_100g':0}};
  assert.equal(normalizeOpenFoodFacts(complete).incomplete,false);
});

test('Selected verified USDA gram portion scales all four nutrients, no label-only changes',()=>{
 const source={name:'Egg',source:'usda',serving_label:'100 g',serving_grams:100,
   calories:143,protein_g:12.6,carbs_g:0.7,fat_g:9.5};
 const portion=foodForPortion(source,{label:'1 large egg (50 g)',grams:50});
 assert.deepEqual([portion.calories,portion.protein_g,portion.carbs_g,portion.fat_g],[71.5,6.3,0.4,4.8]);
 assert.equal(portion.serving_label,'1 large egg (50 g)');
 assert.equal(source.calories,143);
 assert.throws(()=>foodForPortion(source,{label:'Bad',grams:0}),/valid portion/);
});
test('Past USDA anomalies are flagged for review without overwriting history',()=>{
 assert.equal(needsNutritionReview({source:'usda',calories:1026,protein_g:26,carbs_g:1.4,fat_g:19}),true);
 assert.equal(needsNutritionReview({source:'usda',calories:286,protein_g:26,carbs_g:1.4,fat_g:19}),false);
});
test('Restaurant breakfast query offers shorter, clearer search',()=>{
 assert.equal(broaderFoodSearch('Chick-fil-A breakfast'),'Chick-fil-A');
 assert.equal(broaderFoodSearch("Marco's Pizza"),'');
});
