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
  assert.ok(results.some(x=>x.brand==='Cadbury'));
  assert.ok(results.some(x=>x.brand==='Snickers'));
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
  assert.equal(names.length,2);
  assert.ok(names.some(x=>x.source==='usda'));
  assert.ok(names.some(x=>x.source==='fatsecret'));
  assert.ok(names.every(x=>!x.name.includes('San Marcos')));
  assert.equal(restaurantMatches({name:'San Marcos Chicken',brand:'San Marcos'},plan),false);
});
test('Chick-fil-A breakfast and Waffle House bowl fall back without claiming an exact item',()=>{
  const chick=planFoodSearch('Chick-fil-A breakfast');
  const waffle=planFoodSearch('Waffle House bowl');
  assert.equal(chick.restaurant,'Chick-fil-A');
  assert.deepEqual(chick.itemTerms,['breakfast']);
  assert.equal(chick.broadened,true);
  assert.equal(waffle.providerQuery,'Waffle House bowl');
  const records=mergeFoodResults({
    fatsecret:[
      {name:'Breakfast Biscuit',brand:'Chick-fil-A',source:'fatsecret',source_id:'1',can_log:false},
      {name:'Chocolate Waffle',brand:'Waffle House',source:'fatsecret',source_id:'2',can_log:false},
      {name:'Breakfast Burrito',brand:'Other Cafe',source:'fatsecret',source_id:'3',can_log:false}
    ]
  },'Chick-fil-A breakfast');
  assert.equal(records.length,1);
  assert.equal(records[0].name,'Breakfast Biscuit');
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


test('egg and eggs use the identical USDA lookup and equivalent source ranking',()=>{
 const single=planFoodSearch('Egg'),plural=planFoodSearch('eggs');
 assert.equal(single.normalized,'egg');
 assert.equal(plural.normalized,'egg');
 assert.equal(single.providerQuery,'egg');
 assert.equal(plural.providerQuery,'egg');
 assert.deepEqual(single.usdaQueries,['egg','egg, raw']);
 assert.deepEqual(single.usdaQueries,plural.usdaQueries);
 const foods={
   usda:[
     {name:'Egg burrito',source:'usda',data_type:'Survey (FNDDS)',source_id:'1001',can_log:true},
     {name:'Egg omelet or scrambled egg',source:'usda',data_type:'Survey (FNDDS)',source_id:'1002',can_log:true},
     {name:'Egg, whole, raw, fresh',source:'usda',data_type:'SR Legacy',source_id:'1003',can_log:true},
     {name:'Eggs, Grade A, large',source:'usda',data_type:'Foundation',source_id:'1004',can_log:true},
     {name:'Chocolate Egg',source:'openfoodfacts',brand:'Cadbury'}
   ]
 };
 const once=mergeFoodResults(foods,'egg');
 const twice=mergeFoodResults(foods,'eggs');
 assert.deepEqual(once,twice);
 assert.ok(/whole|grade/i.test(once[0].name));
 assert.ok(/whole|grade/i.test(once[1].name));
 assert.ok(once.findIndex(x=>x.name==='Egg burrito')>1);
 assert.equal(once.length,5);
});
test('egg and eggs normalize packaged lookup equally without changing chicken searches',async()=>{
 const calls=[];
 const source=async term=>{
   calls.push(term);
   return [{name:'Egg, whole, raw',source:'openfoodfacts',brand:'',serving_label:'100 g'}];
 };
 const backend={functions:{invoke:async()=>({data:{
   usda:[{name:'Eggs, Grade A, large',source:'usda',data_type:'Foundation',can_log:true}],
   fatsecret:[],providers:{usda:'ok',fatsecret:'not_configured'}
 },error:null})}};
 const egg=await searchAllFoodCatalog('egg',{supabaseClient:backend,searchPackaged:source});
 const eggs=await searchAllFoodCatalog('eggs',{supabaseClient:backend,searchPackaged:source});
 assert.deepEqual(egg,eggs);
 assert.deepEqual(calls,['egg','egg']);
});


test('a general singular/plural strategy applies beyond the tested examples',()=>{
 const pairs=[
   ['apple','apples'],['egg','eggs'],['grape','grapes'],
   ['berry','berries'],['strawberry','strawberries'],
   ['sandwich','sandwiches'],['tomato','tomatoes'],
   ['potato','potatoes'],['cookie','cookies'],
   ['chicken breast','chicken breasts'],
   ['waffle house bowl','waffle house bowls']
 ];
 for(const [singular,plural] of pairs){
   const a=planFoodSearch(singular),b=planFoodSearch(plural);
   assert.equal(a.normalized,b.normalized,plural);
   assert.equal(a.providerQuery,b.providerQuery,plural);
   assert.deepEqual(a.usdaQueries,b.usdaQueries,plural);
 }
});
test('apple and apples retrieve identical records, with whole raw fruit ahead of cider',async()=>{
 const foods=[
   {name:'Apple cider',source:'usda',source_id:'cider',data_type:'Survey (FNDDS)',can_log:true},
   {name:'Apples, raw, with skin',source:'usda',source_id:'raw',data_type:'Foundation',can_log:true},
   {name:'Apple juice concentrate',source:'usda',source_id:'juice',data_type:'Survey (FNDDS)',can_log:true},
   {name:'Apple pie',source:'usda',source_id:'pie',data_type:'Survey (FNDDS)',can_log:true},
   {name:'Apple puree',source:'usda',source_id:'puree',data_type:'SR Legacy',can_log:true}
 ];
 const calls=[];
 const backend={functions:{invoke:async({body})=>{
   calls.push(body.query);
   return {data:{usda:foods,fatsecret:[],providers:{usda:'ok',fatsecret:'not_configured'}},error:null};
 }}};
 const packaged=async query=>{calls.push('packaged:'+query);return [];};
 const apple=await searchAllFoodCatalog('apple',{supabaseClient:backend,searchPackaged:packaged});
 const apples=await searchAllFoodCatalog('apples',{supabaseClient:backend,searchPackaged:packaged});
 assert.deepEqual(apple,apples);
 assert.equal(apple[0].source_id,'raw');
 assert.ok(apple.findIndex(x=>x.source_id==='cider')>0);
 assert.deepEqual(calls,['apple','packaged:apple','apples','packaged:apple']);
});
test('restaurant dish intent requires the dish term, not just a matching restaurant name',()=>{
 const raw=[
   {name:'Original Sweet Cream Waffle Mix',brand:'Waffle House',source:'usda',data_type:'Branded',can_log:true},
   {name:'Waffle House Original Sweet Cream Waffle Mix',source:'usda',data_type:'Branded',can_log:true},
   {name:'Hashbrown Bowl',brand:'Waffle House',source:'fatsecret',source_id:'334',can_log:false},
   {name:'Breakfast Waffle',brand:'Waffle House',source:'fatsecret',source_id:'335',can_log:false}
 ];
 const onlyBowl=mergeFoodResults({usda:raw.slice(0,2),fatsecret:raw.slice(2)},'Waffle House bowl');
 assert.equal(onlyBowl.length,1);
 assert.equal(onlyBowl[0].name,'Hashbrown Bowl');
 assert.deepEqual(mergeFoodResults({usda:raw.slice(0,2),fatsecret:[raw[3]]},'Waffle House bowl'),[]);
});
test('restaurant searches never fabricate a matching menu entry from a broadly returned provider item',async()=>{
 const result=await searchAllFoodCatalog('Waffle House bowl',{
  supabaseClient:{functions:{invoke:async()=>({data:{
   usda:[{name:'Waffle House Waffle Mix',source:'usda',data_type:'Branded',can_log:true}],
   fatsecret:[{name:'Waffles',brand:'Waffle House',source:'fatsecret',source_id:'foo',can_log:false}],
   providers:{usda:'ok',fatsecret:'ok'}
  },error:null})}},
  searchPackaged:async()=>[]
 });
 assert.equal(result.length,0);
});


test('word boundaries prevent grape/grapefruit and egg/eggplant false positives',()=>{
 assert.equal(rankFoodMatch({name:'Grapefruit',source:'usda',data_type:'Foundation'},'grape'),-1);
 assert.equal(rankFoodMatch({name:'Pineapple, raw',source:'usda',data_type:'Foundation'},'apple'),-1);
 assert.equal(rankFoodMatch({name:'Eggplant',source:'usda',data_type:'Foundation'},'eggs'),-1);
 assert.ok(rankFoodMatch({name:'Grapes, red, raw',source:'usda',data_type:'Foundation'},'grape')>0);
 assert.ok(rankFoodMatch({name:'Blueberry',source:'usda',data_type:'Foundation'},'blueberries')>0);
});
