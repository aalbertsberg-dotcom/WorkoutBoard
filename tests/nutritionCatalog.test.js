import test from 'node:test';
import assert from 'node:assert/strict';
import {foodSearchUrl,searchALiciousUrl,searchALiciousProducts,
  rankFoodProducts,scoreFoodMatch,searchFoodCatalog,lookupFoodBarcode} from '../src/nutritionCatalog.js';

const product=(name,code='1234567890123',calories=120)=>({
  product_name:name,code,serving_size:'30 g',serving_quantity:30,
  nutriments:{'energy-kcal_100g':calories/0.3,'proteins_100g':20,'carbohydrates_100g':10,'fat_100g':4}
});

test('dedicated search supports full text; legacy request remains a valid fallback',()=>{
  const url=new URL(searchALiciousUrl('egg large'));
  assert.equal(url.host,'search.openfoodfacts.org');
  assert.equal(url.pathname,'/search');
  assert.equal(url.searchParams.get('q'),'egg large');
  assert.ok(url.searchParams.get('fields').includes('nutriments'));
  const legacy=new URL(foodSearchUrl('pepper jack'));
  assert.equal(legacy.pathname,'/cgi/search.pl');
  assert.equal(legacy.searchParams.get('search_terms'),'pepper jack');
  assert.equal(legacy.searchParams.get('json'),'1');
  assert.ok(legacy.searchParams.get('fields').includes('nutriments'));
});
test('dedicated search accepts full documents or source wrapper results',()=>{
  assert.deepEqual(searchALiciousProducts({hits:[{_source:product('Eggs')},product('Bacon')]}).map(x=>x.product_name),['Eggs','Bacon']);
  assert.throws(()=>searchALiciousProducts({products:[]}),/invalid/);
});
test('unrelated foods filtered and exact match ranked highest',()=>{
  const rows=rankFoodProducts([
    product('Pepper Jack Cheese','000002'),
    product('Formage Blanc','000003'),
    product('Pepper Jack','000004'),
    product('Pepper Jack','000004')
  ],'pepper jack');
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,'Pepper Jack');
  assert.equal(scoreFoodMatch({name:'Cereal'},'egg'),-1);
});
test('dedicated food index provides relevant result and second search uses cache',async t=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{
    calls++;
    assert.equal(new URL(url).host,'search.openfoodfacts.org');
    return {ok:true,status:200,json:async()=>({hits:[
      {_source:product('Eggs large','710001')},
      {_source:product('Blue cheese','710002')}
    ]})};
  };
  t.after(()=>{globalThis.fetch=old});
  const first=await searchFoodCatalog('eggs large');
  assert.equal(first.length,1);
  assert.equal(first[0].name,'Eggs large');
  const second=await searchFoodCatalog('eggs large');
  assert.equal(second.length,1);
  assert.equal(second[0].cached,true);
  assert.equal(calls,1);
});
test('legacy search is used when dedicated index cannot be reached',async t=>{
  const old=globalThis.fetch;const calls=[];
  globalThis.fetch=async url=>{
    calls.push(new URL(url));
    if(calls.length===1)throw new TypeError('Failed to fetch');
    return {ok:true,status:200,json:async()=>({products:[product('Chicken wing','720001')]})};
  };
  t.after(()=>{globalThis.fetch=old});
  const rows=await searchFoodCatalog('chicken wing');
  assert.equal(rows[0].name,'Chicken wing');
  assert.equal(calls.length,2);
  assert.equal(calls[0].host,'search.openfoodfacts.org');
  assert.equal(calls[1].host,'world.openfoodfacts.org');
});
test('US catalog is attempted after both dedicated search and world fail',async t=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{
    calls++;
    if(calls<3)throw new TypeError('Failed to fetch');
    assert.equal(new URL(url).host,'us.openfoodfacts.org');
    return {ok:true,status:200,json:async()=>({products:[product('Eggs free range','730001')]})};
  };
  t.after(()=>{globalThis.fetch=old});
  const rows=await searchFoodCatalog('eggs free range');
  assert.equal(rows[0].name,'Eggs free range');
  assert.equal(calls,3);
});
test('network failure has actionable message when all sources fail',async t=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch')};
  t.after(()=>{globalThis.fetch=old});
  await assert.rejects(searchFoodCatalog('hard boiled eggs'),/Could not connect to a food database/);
});
test('barcode lookup continues using the direct product endpoint',async t=>{
  const old=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/\/api\/v2\/product\/12345678\.json/);
    return {ok:true,status:200,json:async()=>({status:1,product:product('Test product','12345678')})};
  };
  t.after(()=>{globalThis.fetch=old});
  const food=await lookupFoodBarcode('12345678');
  assert.equal(food.name,'Test product');
});
