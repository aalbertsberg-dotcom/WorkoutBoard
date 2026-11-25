import test from 'node:test';
import assert from 'node:assert/strict';
import {usdaNutrients,usdaPortions,normalizeUsdaSearchFood,needsNutritionReview} from '../supabase/functions/nutrition-search/usdaNutrition.js';

const egg=(value=143,unit='KCAL')=>({
  description:'Egg, whole, raw',fdcId:10008,dataType:'Foundation',
  foodNutrients:[
    {nutrientId:1008,unitName:unit,value},
    {nutrientId:1003,unitName:'G',value:12.6},
    {nutrientId:1005,unitName:'G',value:0.7},
    {nutrientId:1004,unitName:'G',value:9.5},
  ],
  foodPortions:[{portionDescription:'1 large egg',gramWeight:50}]
});
test('USDA kcal per 100 g and authoritative gram-weight household portions',()=>{
 const normalized=normalizeUsdaSearchFood(egg());
 assert.equal(normalized.calories,143);
 assert.equal(normalized.serving_label,'100 g');
 assert.equal(normalized.can_log,true);
 assert.deepEqual(normalized.serving_options,[
   {label:'100 g',grams:100},
   {label:'1 large egg (50 g)',grams:50}
 ]);
});
test('USDA energy explicitly measured in kJ converts to kcal',()=>{
 const normalized=normalizeUsdaSearchFood(egg(598,'KJ'));
 assert.ok(Math.abs(normalized.calories-142.9)<1);
 assert.equal(normalized.can_log,true);
});
test('513 kcal egg contradicts macros, cannot be logged as credible',()=>{
 const normalized=normalizeUsdaSearchFood(egg(513,'KCAL'));
 assert.equal(normalized.can_log,false);
 assert.match(normalized.validation_warning,/conflict/);
});
test('43.5 kcal pizza with high fat, protein and carbs cannot be logged',()=>{
 const pizza={description:'Large pizza slice',foodNutrients:[
   {nutrientId:1008,unitName:'KCAL',value:43.5},
   {nutrientId:1003,value:12},
   {nutrientId:1005,value:28},
   {nutrientId:1004,value:9}
 ]};
 assert.equal(normalizeUsdaSearchFood(pizza).can_log,false);
});
test('USDA data with incomplete macros is marked unverified, not fabricated as verified',()=>{
 const example={description:'Mystery product',foodNutrients:[{nutrientId:1008,value:150}]};
 const food=normalizeUsdaSearchFood(example);
 assert.equal(food.can_log,false);
 assert.equal(food.incomplete,true);
});
test('Unverified portions are not invented or labelled one egg',()=>{
 const food={description:'Egg',foodNutrients:egg().foodNutrients};
 assert.deepEqual(usdaPortions(food),[{label:'100 g',grams:100}]);
});
test('Branded 45 gram weight is correctly scaled from 100g',()=>{
 const p={...egg(),dataType:'Branded',servingSize:45,servingSizeUnit:'g',
   householdServingFullText:'1 wrap'};
 const food=normalizeUsdaSearchFood(p);
 assert.equal(food.calories,64.4);
 assert.equal(food.serving_grams,45);
 assert.equal(food.serving_label,'1 wrap');
});
test('Historic contradictory USDA entries are flagged without changing their values',()=>{
 assert.equal(needsNutritionReview({source:'usda',calories:1026,protein_g:26,carbs_g:2,fat_g:20}),true);
 assert.equal(needsNutritionReview({source:'usda',calories:286,protein_g:26,carbs_g:2,fat_g:20}),false);
 assert.equal(needsNutritionReview({source:'manual',calories:1026,protein_g:26,carbs_g:2,fat_g:20}),false);
});
