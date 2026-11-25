import test from 'node:test';
import assert from 'node:assert/strict';
import {planFoodSearch,normalizeFoodText,rankFoodMatch,restaurantMatches} from '../supabase/functions/nutrition-search/foodSearchPlan.js';
import {mergeFoodResults,searchAllFoodCatalog} from '../src/nutritionMultiSearch.js';

test('ordinary egg search ranks USDA common eggs above Snickers chocolate eggs',()=>{
  const query=planFoodSearch('Egg');
  assert.equal(query.common,true);
  const results=mergeFoodResults({
    usda:[
      {name:'SNICKERS Easter Chocolate Egg',brand:'Snickers',source:'usda',data_type:'Branded',can_log:true},
      {name:'Egg, whole, raw',brand:'',source:'usda',data_type:'Foundation',can_log:true},
      {name:'Eggs, scrambled',brand:'',source:'usda',data_type:'Survey (FNDDS)',can_log:true}
    ],
    openfoodfacts:[{name:'Cadbury Creme Egg',brand:'Cadbury',source:'openfoodfacts'}],
    fatsecret:[]
  },'egg');
  assert.equal(results[0].name,'Egg, whole, raw');
  assert.equal(results[1].name,'Eggs, scrambled');
  assert.equal(results.at(-1).brand,'Cadbury');
  assert.ok(rankFoodMatch({name:'Eggplant',source:'usda',data_type:'Foundation'},'egg')<0);
});
test('restaurant aliases are exact enough to exclude San Marcos products',()=>{
  const plan=planFoodSearch("Marcos");
  assert.equal(plan.restaurant,"Marco's Pizza");
  assert.equal(plan.providerQuery,"Marco's Pizza");
  const names=mergeFoodResults({
    usda:[{name:'San Marcos Tomato Salsa',source:'usda',data_type:'Branded'},
      {name:"Marco's Pizza Pepperoni Large",source:'usda',data_type:'Branded'}],
    fatsecret:[{name:'Bacon Pizza',brand:"Marco's Pizza",source:'fatsecret',source_id:'901',can_log:false}]
  },'marcos');
  assert.deepEqual(names.map(x=>x.source),['usda','fatsecret']);
  assert.ok(names.every(x=>!x.name.includes('San Marcos')));
  assert.equal(restaurantMatches({name:'San Marcos Chicken',brand:'San Marcos'},plan),false);
});
test('Chick-fil-A breakfast and Waffle House bowl fall back without claiming an exact item',()=>{
  const chick=planFoodSearch('Chick-fil-A breakfast');
  const waffle=planFoodSearch('Waffle House bowl');
  assert.equal(chick.restaurant,'Chick-fil-A');
  assert.deepEqual(chick.itemTerms,['breakfast']);
  assert.equal(chick.broadened,true);
  assert.equal(waffle.providerQuery,'Waffle House');
  const records=mergeFoodResults({
    fatsecret:[
      {name:'Chicken Biscuit',brand:'Chick-fil-A',source:'fatsecret',source_id:'1',can_log:false},
      {name:'Chocolate Waffle',brand:'Waffle House',source:'fatsecret',source_id:'2',can_log:false},
      {name:'Breakfast Burrito',brand:'Other Cafe',source:'fatsecret',source_id:'3',can_log:false}
    ]
  },'Chick-fil-A breakfast');
  assert.equal(records.length,1);
  assert.equal(records[0].name,'Chicken Biscuit');
  assert.ok(rankFoodMatch({name:'Breakfast Bowl',brand:'Waffle House',source:'fatsecret'},waffle)>
    rankFoodMatch({name:'Waffle',brand:'Waffle House',source:'fatsecret'},waffle));
});
test('FatSecret status reaches UI even when USDA and packaged food searches succeed',async()=>{
  const seen=[];
  const result=await searchAllFoodCatalog('Waffle House bowl',{
    supabaseClient:{functions:{invoke:async()=>({data:{
      usda:[],fatsecret:[],
      providers:{usda:'ok',fatsecret:'authentication_failed'}
    },error:null})}},
    searchPackaged:async()=>[],
    onDiagnostics:d=>seen.push(d)
  });
  assert.deepEqual(result,[]);
  assert.equal(seen[0].fatsecret,'authentication_failed');
  assert.equal(seen[0].restaurant,'Waffle House');
});
test('Marcos search returns only the proper restaurant when food providers differ',async()=>{
 const found=await searchAllFoodCatalog('marcos',{
    supabaseClient:{functions:{invoke:async()=>({data:{
      usda:[{name:'San Marcos Tortilla Chips',source:'usda',data_type:'Branded',can_log:true}],
      fatsecret:[{name:'Pepperoni Pizza',brand:"Marco's Pizza",source:'fatsecret',source_id:'991',can_log:false}],
      providers:{usda:'ok',fatsecret:'ok'}
    },error:null})}},
    searchPackaged:async()=>[{name:'San Marcos Brown Rice',source:'openfoodfacts'}]
  });
  assert.equal(found.length,1);
  assert.equal(found[0].brand,"Marco's Pizza");
});
test('normalization keeps restaurant apostrophes and hyphenated names equivalent',()=>{
  assert.equal(normalizeFoodText("Marco’s Pizza"),'marcos pizza');
  assert.equal(normalizeFoodText("Chick-fil-A"),'chick fil a');
});
