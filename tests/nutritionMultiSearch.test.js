import test from 'node:test';
import assert from 'node:assert/strict';
import {foodSourceLabel,mergeFoodResults,searchAllFoodCatalog} from '../src/nutritionMultiSearch.js';

const usda={name:'Chicken Breast',brand:'',source:'usda',can_log:true,calories:165,source_id:'123'};
const open={name:'Packaged Chicken Breast',brand:'Brand',source:'openfoodfacts',can_log:true,source_id:'456'};
const fat={name:'Chicken Breast Sandwich',brand:'Restaurant',source:'fatsecret',can_log:false,source_id:'789'};
test('multi-source search preserves stable ordering with USDA first and preview last',()=>{
 const arr=mergeFoodResults({fatsecret:[fat],openfoodfacts:[open],usda:[usda]});
 assert.deepEqual(arr.map(x=>x.source),['usda','openfoodfacts','fatsecret']);
 assert.equal(foodSourceLabel(usda),'USDA · Common food');
 assert.match(foodSourceLabel(fat),/preview/);
});
test('multi-source search returns USDA entries when packaged lookup errors',async()=>{
 const replies=[];
 const foods=await searchAllFoodCatalog('chicken',{
  supabaseClient:{functions:{invoke:async()=>({data:{
    usda:[usda],fatsecret:[fat],providers:{usda:'ok',fatsecret:'ok'}
  },error:null})}},
  searchPackaged:async()=>{throw Error('Packaging database unreachable');},
  onResults:results=>replies.push(results.map(x=>x.source))
 });
 assert.equal(foods.length,2);
 assert.deepEqual(replies.at(-1),['usda','fatsecret']);
});
test('USDA function not configured still falls back to Open Food Facts',async()=>{
 const foods=await searchAllFoodCatalog('chicken',{
  supabaseClient:{functions:{invoke:async()=>({data:{usda:[],fatsecret:[],
    providers:{usda:'not_configured',fatsecret:'not_configured'}},error:null})}},
  searchPackaged:async()=>[open]
 });
 assert.deepEqual(foods,[open]);
});
test('FatSecret previews can never masquerade as loggable foods from backend',async()=>{
 const foods=await searchAllFoodCatalog('chicken',{
  supabaseClient:{functions:{invoke:async()=>({data:{usda:[],fatsecret:[
    {...fat,can_log:true},
    {...fat,source_id:'790',can_log:false}
  ],providers:{usda:'not_configured',fatsecret:'ok'}},error:null})}},
  searchPackaged:async()=>[]
 });
 assert.equal(foods.length,1);
 assert.equal(foods[0].can_log,false);
});
test('network failures across all providers result in error and preserve saved foods',async()=>{
 await assert.rejects(searchAllFoodCatalog('apple',{
  supabaseClient:{functions:{invoke:async()=>{throw Error('Offline')}}},
  searchPackaged:async()=>{throw Error('No connection')}
 }),/Offline|No connection/);
});

test('Marco’s Pizza excludes Pizza Hut, dessert pizza, and unrelated Marco cheese',()=>{
 const records=mergeFoodResults({
   usda:[
     {name:'PIZZA HUT 12-inch Pepperoni Pizza',brand:'',source:'usda'},
     {name:'Dessert pizza',brand:'',source:'usda'},
     {name:'Marco’s Pizza, Pepperoni',brand:'',source:'usda'}
   ],
   openfoodfacts:[{name:'Marco Polo Handmade Cheese',brand:'',source:'openfoodfacts'}],
   fatsecret:[{name:'Pepperoni Magnifico',brand:'Marco’s Pizza',source:'fatsecret',source_id:'98',can_log:false}]
 },"Marco's Pizza");
 assert.equal(records.length,2);
 assert.deepEqual(records.map(x=>x.source),['fatsecret','usda']);
 assert.ok(records.some(x=>x.name==='Marco’s Pizza, Pepperoni'));
 assert.equal(records[0].brand,'Marco’s Pizza');
});
test('Chicken breast matches relevant cuts only, burger still matches cheeseburger',()=>{
 const records=mergeFoodResults({usda:[
   {name:'Chicken breast',source:'usda'},
   {name:'Chicken sausage',source:'usda'},
   {name:'Breaded chicken breast',source:'usda'}
 ]},'chicken breast');
 assert.equal(records.length,2);
 assert.equal(mergeFoodResults({fatsecret:[{...fat,name:'Cheeseburger'}]},'burger').length,1);
});
test('Two providers publish once after both finish, avoiding reordered cards',async()=>{
 const notifications=[];
 const foods=await searchAllFoodCatalog('chicken',{
   supabaseClient:{functions:{invoke:async()=>({data:{usda:[usda],fatsecret:[],
     providers:{usda:'ok',fatsecret:'not_configured'}},error:null})}},
   searchPackaged:async()=>[open],
   onResults:value=>notifications.push(value)
 });
 assert.equal(notifications.length,1);
 assert.deepEqual(notifications[0],foods);
});
