import test from 'node:test';
import assert from 'node:assert/strict';
import {foodSearchUrl,rankFoodProducts,scoreFoodMatch,searchFoodCatalog,lookupFoodBarcode} from '../src/nutritionCatalog.js';

const product=(name,code='1234567890123',calories=120)=>({
  product_name:name,code,serving_size:'30 g',serving_quantity:30,
  nutriments:{'energy-kcal_100g':calories/0.3,'proteins_100g':20,'carbohydrates_100g':10,'fat_100g':4}
});

test('food search uses keyword-capable legacy endpoint, never v2 structured search',()=>{
  const url=new URL(foodSearchUrl('pepper jack'));
  assert.equal(url.pathname,'/cgi/search.pl');
  assert.equal(url.searchParams.get('search_terms'),'pepper jack');
  assert.equal(url.searchParams.get('search_simple'),'1');
  assert.equal(url.searchParams.get('action'),'process');
  assert.equal(url.searchParams.get('json'),'1');
  assert.ok(url.searchParams.get('fields').includes('nutriments'));
});
test('search filters unrelated results and ranks matching names higher',()=>{
  const list=rankFoodProducts([
    product('Formage Blanc Nature','000001'),
    product('Pepper Jack Cheese','000002'),
    product('Cheese, Pepper Jack Slices','000003'),
    product('Pepper Jack Cheese','000002')
  ],'pepper jack');
  assert.equal(list.length,2);
  assert.equal(list[0].name,'Pepper Jack Cheese');
  assert.ok(list.every(row=>row.name.toLowerCase().includes('pepper')&&row.name.toLowerCase().includes('jack')));
  assert.equal(scoreFoodMatch({name:'Chocolate bar'},'egg'),-1);
  assert.ok(scoreFoodMatch({name:'Eggs large'},'egg')>0);
});
test('keyword search returns only matching packaged foods and does not show irrelevant catalog rows',async t=>{
  const old=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(new URL(url));
    return {ok:true,status:200,json:async()=>({products:[
      product('Jben','000004'),
      product('Pepper Jack Cheese','000005',90),
      product('Cheese spread','000006')
    ]})};
  };
  t.after(()=>{globalThis.fetch=old});
  const rows=await searchFoodCatalog('pepper jack');
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,'Pepper Jack Cheese');
  assert.equal(rows[0].calories,90);
  assert.equal(calls.length,1);
  assert.equal(calls[0].pathname,'/cgi/search.pl');
});
test('search retries US-host if world catalog cannot be reached',async t=>{
  const old=globalThis.fetch;
  let tries=0;
  globalThis.fetch=async url=>{
    tries++;
    if(tries===1)throw new TypeError('Failed to fetch');
    assert.equal(new URL(url).host,'us.openfoodfacts.org');
    return {ok:true,status:200,json:async()=>({products:[product('Eggs large','000007')]})};
  };
  t.after(()=>{globalThis.fetch=old});
  const result=await searchFoodCatalog('Egg');
  assert.equal(result[0].name,'Eggs large');
  assert.equal(tries,2);
});
test('search errors remain understandable when both public endpoints are unavailable',async t=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch')};
  t.after(()=>{globalThis.fetch=old});
  await assert.rejects(searchFoodCatalog('pizza'),/Could not reach Open Food Facts/);
});
test('barcode lookup continues using product endpoint',async t=>{
  const old=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/\/api\/v2\/product\/12345678\.json/);
    return {ok:true,status:200,json:async()=>({status:1,product:product('Pepper Jack Cheese','12345678')})};
  };
  t.after(()=>{globalThis.fetch=old});
  const food=await lookupFoodBarcode('12345678');
  assert.equal(food.name,'Pepper Jack Cheese');
});
