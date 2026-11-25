const {test,expect}=require('@playwright/test')

async function visitOffline(page){
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false})
  })
  await page.goto('/tests/fixtures/nutrition.html')
  await expect(page.getByRole('heading',{name:'Nutrition & hydration'})).toBeVisible()
}
test('Offline water entries persist after reload, with user-selectable macro mode',async({page})=>{
  await visitOffline(page)
  await page.getByRole('button',{name:'+ 8 oz'}).click()
  await expect(page.locator('.nutrition-water-card')).toContainText('8 / 64 oz')
  await page.getByRole('button',{name:'Macros',exact:true}).click()
  await expect(page.getByRole('button',{name:'Macros',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.reload()
  await expect(page.locator('.nutrition-water-card')).toContainText('8 / 64 oz')
  await expect(page.getByRole('button',{name:'Macros',exact:true})).toHaveAttribute('aria-pressed','true')
})
test('Custom food logs macros and supports confirmation before deleting',async({page})=>{
  await visitOffline(page)
  await page.getByRole('button',{name:'Add food',exact:true}).click()
  await page.locator('.nutrition-custom summary').click()
  const inputs=page.locator('.nutrition-custom-fields input')
  await inputs.nth(0).fill('Test oats')
  await inputs.nth(3).fill('120')
  await inputs.nth(4).fill('6')
  await inputs.nth(5).fill('20')
  await inputs.nth(6).fill('3')
  await page.getByRole('button',{name:'Save custom food'}).click()
  await expect(page.getByRole('heading',{name:'Log Test oats'})).toBeVisible()
  await page.getByRole('button',{name:'Log food',exact:true}).click()
  await expect(page.locator('.nutrition-food-diary')).toContainText('Test oats')
  await expect(page.locator('.nutrition-food-diary')).toContainText('120 kcal')
  await page.getByRole('button',{name:'Save meal'}).click()
  const mealDialog=page.getByRole('alertdialog',{name:'Name this reusable meal'})
  await expect(mealDialog).toBeVisible()
  await mealDialog.getByRole('button',{name:'Save'}).click()
  await page.getByRole('button',{name:'Saved',exact:true}).click()
  await expect(page.locator('.nutrition-saved-row').filter({hasText:'Breakfast meal'})).toHaveCount(1)
  await page.getByRole('button',{name:'Food diary',exact:true}).click()
  await page.locator('.nutrition-entry').filter({hasText:'Test oats'}).getByRole('button',{name:'Remove'}).click()
  const dialog=page.getByRole('alertdialog',{name:'Remove saved nutrition entry?'})
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{name:'Keep'}).click()
  await expect(page.locator('.nutrition-food-diary')).toContainText('Test oats')
  await page.locator('.nutrition-entry').filter({hasText:'Test oats'}).getByRole('button',{name:'Remove'}).click()
  await page.getByRole('alertdialog').getByRole('button',{name:'Remove'}).click()
  await expect(page.locator('.nutrition-food-diary')).not.toContainText('Test oats')
})


test('Public food search matches query and empty calorie meter is not a green button',async({page})=>{
  const calls=[];
  await page.route('https://search.openfoodfacts.org/search**',async route=>{
    const url=new URL(route.request().url());
    calls.push(url);
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({count:2,hits:[
        {product_name:'Pepper Jack Cheese',code:'1234567890123',brands:'Test Dairy',
          serving_size:'30 g',serving_quantity:30,nutriments:{
            'energy-kcal_100g':300,'proteins_100g':20,
            'carbohydrates_100g':3,'fat_100g':25
          }},
        {product_name:'Fromage Blanc Nature',code:'8765432109876',
          serving_size:'100 g',serving_quantity:100,nutriments:{'energy-kcal_100g':80}}
      ]})});
  });
  await page.goto('/tests/fixtures/nutrition.html');
  await expect(page.getByRole('heading',{name:'Nutrition & hydration'})).toBeVisible();
  const meter=page.locator('.nutrition-summary .nutrient-meter.is-emphasized').first();
  await expect(meter).toBeVisible();
  await expect(meter).not.toHaveClass(/\bprimary\b/);
  const initial=await meter.evaluate(node=>({
    background:getComputedStyle(node).backgroundColor,
    fillWidth:node.querySelector('.nutrient-meter-track>div').getBoundingClientRect().width
  }));
  expect(initial.background).toBe('rgba(0, 0, 0, 0)');
  expect(initial.fillWidth).toBe(0);
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  await page.getByRole('searchbox',{name:'Food search'}).fill('pepper jack');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results button')).toHaveCount(1);
  await expect(page.locator('.nutrition-results')).toContainText('Pepper Jack Cheese');
  expect(calls).toHaveLength(1);
  expect(calls[0].pathname).toBe('/search');
  expect(calls[0].searchParams.get('q')).toBe('pepper jack');
  await page.locator('.nutrition-results button').click();
  await page.getByRole('button',{name:'Log food',exact:true}).click();
  await expect(page.locator('.nutrition-food-diary')).toContainText('Pepper Jack Cheese');
  const after=await meter.evaluate(node=>{
    const track=node.querySelector('.nutrient-meter-track');
    const fill=track.firstElementChild;
    return {trackWidth:track.getBoundingClientRect().width,fillWidth:fill.getBoundingClientRect().width};
  });
  expect(after.fillWidth).toBeGreaterThan(0);
  expect(after.fillWidth).toBeLessThan(after.trackWidth);
});


test('Egg search falls back to product catalog and cached results remain available offline',async({page})=>{
  const requested=[];
  await page.route('https://search.openfoodfacts.org/search**',async route=>{
    requested.push('dedicated');
    await route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline"}',
      headers:{'access-control-allow-origin':'*'}});
  });
  await page.route('https://world.openfoodfacts.org/cgi/search.pl**',async route=>{
    requested.push('legacy');
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({products:[{product_name:'Eggs large',code:'5599000011111',
        serving_size:'1 egg',serving_quantity:50,
        nutriments:{'energy-kcal_100g':140,'proteins_100g':13,
          'carbohydrates_100g':1,'fat_100g':9}}]})});
  });
  await page.goto('/tests/fixtures/nutrition.html');
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  const field=page.getByRole('searchbox',{name:'Food search'});
  await field.fill('Eggs');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results')).toContainText('Eggs large');
  expect(requested).toEqual(['dedicated','legacy']);
  await page.reload();
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  await field.fill('Eggs');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results')).toContainText('Eggs large');
  await expect(page.getByRole('status')).toContainText('previously found foods');
  expect(requested).toEqual(['dedicated','legacy']);
});


test('USDA nutrition is loggable while FatSecret restaurant data remains preview-only',async({page})=>{
  await page.route('https://example.supabase.co/functions/v1/nutrition-search**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type'},
      body:JSON.stringify({
        usda:[{name:'Beef burger patty',brand:'',source:'usda',source_id:'1099881',
          calories:250,protein_g:26,carbs_g:0,fat_g:18,serving_label:'100 g',can_log:true}],
        fatsecret:[{name:'Cheeseburger',brand:'Example Restaurant',source:'fatsecret',source_id:'120009',
          description:'Per 1 serving - Calories: 300kcal | Protein: 15g',can_log:false,
          source_url:'https://foods.fatsecret.com/calories-nutrition/example/cheeseburger'}],
        providers:{usda:'ok',fatsecret:'ok'}
      })
    });
  });
  await page.route('https://search.openfoodfacts.org/search**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:'{"hits":[]}'});});
  await page.route('https://world.openfoodfacts.org/cgi/search.pl**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:'{"products":[]}'});});
  await page.route('https://us.openfoodfacts.org/cgi/search.pl**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:'{"products":[]}'});});
  await page.goto('/tests/fixtures/nutrition.html');
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  await page.getByRole('searchbox',{name:'Food search'}).fill('burger');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results')).toContainText('Beef burger patty');
  await expect(page.locator('.nutrition-results')).toContainText('Example Restaurant');
  await page.locator('.nutrition-results button').filter({hasText:'FatSecret'}).click();
  await expect(page.locator('.nutrition-provider-preview')).toContainText('does not allow indefinite storage');
  await expect(page.getByRole('button',{name:'Log food',exact:true})).toHaveCount(0);
  await page.locator('.nutrition-provider-preview').getByRole('button',{name:'Close preview'}).click();
  await page.locator('.nutrition-results button').filter({hasText:'USDA'}).click();
  await expect(page.getByRole('button',{name:'Log food',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log food',exact:true}).click();
  await expect(page.locator('.nutrition-food-diary')).toContainText('Beef burger patty');
});


test('Mobile results have one scroller, non-overlapping cards, and compact log selection',async({page})=>{
  const foods=Array.from({length:14},(_,i)=>({
    name:'Chicken breast '+(i+1),brand:'',source:'usda',source_id:'food-'+i,
    calories:165+i,protein_g:31,carbs_g:0,fat_g:4,serving_label:'100 g',can_log:true
  }));
  await page.route('https://example.supabase.co/functions/v1/nutrition-search**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({usda:foods,fatsecret:[],providers:{usda:'ok',fatsecret:'not_configured'}})});
  });
  for(const domain of ['search.openfoodfacts.org/search','world.openfoodfacts.org/cgi/search.pl','us.openfoodfacts.org/cgi/search.pl']){
    await page.route('https://'+domain+'**',async route=>route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify(domain.includes('openfoodfacts.org/search')?{hits:[]}:{products:[]})}));
  }
  await page.goto('/tests/fixtures/nutrition.html');
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  await page.getByRole('searchbox',{name:'Food search'}).fill('Chicken breast');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results button')).toHaveCount(8);
  await expect(page.getByRole('button',{name:/Show more/})).toBeVisible();
  const layout=await page.locator('.nutrition-results').evaluate(el=>{
    const children=[...el.querySelectorAll('button')];
    const rects=children.map(node=>node.getBoundingClientRect());
    return {overflow:getComputedStyle(el).overflowY,
      collisions:rects.some((r,i)=>i>0&&r.top<rects[i-1].bottom-0.5),
      width:el.getBoundingClientRect().width,
      outside:rects.some(r=>r.right>el.getBoundingClientRect().right+1)};
  });
  expect(layout.overflow).toBe('visible');
  expect(layout.collisions).toBe(false);
  expect(layout.outside).toBe(false);
  await page.getByRole('button',{name:/Show more/}).click();
  await expect(page.locator('.nutrition-results button')).toHaveCount(14);
  await page.locator('.nutrition-results button').first().click();
  await expect(page.locator('.nutrition-results')).toHaveCount(0);
  await expect(page.locator('.nutrition-selection-panel')).toBeVisible();
  await expect(page.getByRole('button',{name:'Log food',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log food',exact:true}).click();
  await expect(page.locator('.nutrition-food-diary')).toContainText('Chicken breast 1');
});
test('Marco’s Pizza only shows matching places and clears old results when query edited',async({page})=>{
  await page.route('https://example.supabase.co/functions/v1/nutrition-search**',async route=>{
    const query=route.request().postDataJSON()?.query||'';
    if(query==="Marco's Pizza")await new Promise(resolve=>setTimeout(resolve,700));
    const foods=query==="Marco's Pizza"?[
      {name:'PIZZA HUT Cheese Pizza',brand:'',source:'usda',calories:280,serving_label:'100 g',can_log:true},
      {name:"Marco's Pizza Pepperoni",brand:'',source:'usda',calories:300,serving_label:'100 g',can_log:true}
    ]:[{name:'Chicken breast',source:'usda',calories:165,serving_label:'100 g',can_log:true}];
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({usda:foods,fatsecret:[],providers:{usda:'ok',fatsecret:'not_configured'}})});
  });
  await page.route('https://search.openfoodfacts.org/search**',async route=>
    route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:'{"hits":[]}'}));
  for(const host of ['world','us']){
    await page.route('https://'+host+'.openfoodfacts.org/cgi/search.pl**',async route=>
      route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},body:'{"products":[]}'}));
  }
  await page.goto('/tests/fixtures/nutrition.html');
  await page.getByRole('button',{name:'Add food',exact:true}).click();
  const field=page.getByRole('searchbox',{name:'Food search'});
  await field.fill("Marco's Pizza");
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await field.fill('Chicken breast');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results')).toContainText('Chicken breast');
  await page.waitForTimeout(850); // earlier slower request must never overwrite
  await expect(page.locator('.nutrition-results')).not.toContainText('Marco');
  await expect(page.locator('.nutrition-results-top')).toContainText('"Chicken breast"');
  await field.fill("Marco's Pizza");
  await expect(page.locator('.nutrition-results')).toHaveCount(0);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.nutrition-results button')).toHaveCount(1);
  await expect(page.locator('.nutrition-results')).toContainText("Marco's Pizza Pepperoni");
  await expect(page.locator('.nutrition-results')).not.toContainText('PIZZA HUT');
});
