import {useEffect,useMemo,useRef,useState} from 'react';
import {BarcodeDetector as BarcodeDetectorPonyfill} from 'barcode-detector/ponyfill';
import {supabase} from './supabase';
import {confirmWorkset,promptWorkset} from './worksetDialogs';
import {readOfflineState,writeOfflineState,upsertOfflineFirst,offlineUuid,syncOfflineQueue,getPendingOfflineCount,isOnline} from './offline';
import {NUTRITION_DEFAULTS,MEALS,dateKey,round1,nonnegative,multipliedNutrients,makeFoodEntry,makeWaterEntry,summarizeDay,nutrientSum,nutritionHistory,recipePerServing,foodForPortion,needsNutritionReview,broaderFoodSearch} from './nutritionModel';
import {lookupFoodBarcode} from './nutritionCatalog';
import {searchAllFoodCatalog,foodSourceLabel} from './nutritionMultiSearch';
import {planFoodSearch} from '../supabase/functions/nutrition-search/foodSearchPlan.js';
import './nutrition.css';

const makeState=()=>({preferences:{...NUTRITION_DEFAULTS},foods:[],entries:[],water:[]});
const CACHE_KEY='nutrition-hydration-v1';
const buckets={preferences:'preferences',foods:'foods',entries:'entries',water:'water'};
const tables={preferences:'nutrition_preferences',foods:'nutrition_foods',entries:'nutrition_entries',water:'hydration_entries'};
const fmt=value=>round1(value).toLocaleString(undefined,{maximumFractionDigits:1});
const validNumber=(value,max=100000)=>Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=max;
const dayShift=(date,days)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return dateKey(d)};
const cacheFor=id=>id?{...makeState(),...(readOfflineState(id,CACHE_KEY)||{})}:makeState();
const updated=(rows,row)=>[row,...(rows||[]).filter(item=>item.id!==row.id)];
const emptyFields=()=>({name:'',brand:'',serving_label:'1 serving',calories:'',protein_g:'',carbs_g:'',fat_g:''});
const cleanFood=(food,userId,id=offlineUuid())=>({
  id,user_id:userId,name:String(food.name||'').trim().slice(0,180),brand:String(food.brand||'').slice(0,120),
  serving_label:String(food.serving_label||'1 serving').slice(0,120),serving_grams:food.serving_grams||null,
  barcode:String(food.barcode||''),source:String(food.source||'manual').slice(0,36),
  source_id:String(food.source_id||'').slice(0,100),
  calories:round1(food.calories),protein_g:round1(food.protein_g),carbs_g:round1(food.carbs_g),fat_g:round1(food.fat_g),
  is_recipe:Boolean(food.is_recipe),is_favorite:true,ingredients:food.ingredients||[],
  deleted_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()
});
const asFood=row=>({...row,can_log:!needsNutritionReview(row),validation_warning:needsNutritionReview(row)?'Previously logged USDA calories are inconsistent; verify against a reliable source.':'',...Object.fromEntries(['calories','protein_g','carbs_g','fat_g'].map(field=>[field,round1(nonnegative(row[field])/Math.max(0.001,Number(row.quantity)||1))]))});
const validCustom=fields=>String(fields.name||'').trim()&&['calories','protein_g','carbs_g','fat_g'].every(key=>validNumber(fields[key],50000));

function ProgressMetric({label,value,goal,unit='',primary=false}){
  const limit=Math.max(0,Number(goal)||0);
  const pct=limit>0?Math.min(100,Math.round(nonnegative(value)/limit*100)):0;
  return <div className={'nutrient-meter'+(primary?' is-emphasized':'')}>
    <div className="nutrient-meter-label"><span>{label}</span><strong>{fmt(value)} <small>/ {fmt(goal)}{unit?' '+unit:''}</small></strong></div>
    <div className="nutrient-meter-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={Math.max(1,limit)} aria-valuenow={Math.min(nonnegative(value),Math.max(1,limit))}>
      <div style={{width:pct+'%'}}/>
    </div>
  </div>;
}
export function NutritionTodayCard({session,onOpen}){
  const userId=session?.user?.id;
  const [today,setToday]=useState(()=>summarizeDay(cacheFor(userId).entries,cacheFor(userId).water));
  const [prefs,setPrefs]=useState(()=>cacheFor(userId).preferences);
  useEffect(()=>{
    const refresh=()=>{
      const data=cacheFor(userId);
      setToday(summarizeDay(data.entries,data.water));
      setPrefs(data.preferences||NUTRITION_DEFAULTS);
    };
    refresh();
    window.addEventListener('workset:nutrition-change',refresh);
    return ()=>window.removeEventListener('workset:nutrition-change',refresh);
  },[userId]);
  if(!userId)return null;
  const mode=prefs.mode||'calories';
  return <button type="button" className="nutrition-today-card" onClick={onOpen}>
    <span className="nutrition-today-copy"><small>NUTRITION & HYDRATION</small><strong>Food & water</strong>
      <span>{mode==='macros'?'Protein '+fmt(today.protein_g)+' g · Carbs '+fmt(today.carbs_g)+' g · Fat '+fmt(today.fat_g)+' g'
        :fmt(today.calories)+' / '+fmt(prefs.calorie_goal)+' kcal'}<br/>Water {fmt(today.water_oz)} / {fmt(prefs.water_goal_oz)} oz</span>
    </span><span className="nutrition-card-chevron" aria-hidden="true">›</span>
  </button>;
}
async function readAll(table,userId,order){
  const rows=[];
  for(let offset=0;offset<10000;offset+=500){
    const reply=await supabase.from(table).select('*').eq('user_id',userId)
      .order(order,{ascending:false}).range(offset,offset+499);
    if(reply.error)throw reply.error;
    rows.push(...(reply.data||[]));
    if((reply.data||[]).length<500)return rows;
  }
  throw new Error('Food history is too large to load in one view. Contact support.');
}

export default function NutritionPage({session,onBack}){
  const userId=session?.user?.id||null;
  const activeUser=useRef(userId);activeUser.current=userId;
  const [data,setData]=useState(()=>cacheFor(userId));
  const [goals,setGoals]=useState(()=>({...cacheFor(userId).preferences}));
  const [date,setDate]=useState(()=>dateKey());
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState('log');
  const [search,setSearch]=useState('');
  const [results,setResults]=useState([]);
  const lastOfflineSave=useRef(false);
  const [searching,setSearching]=useState(false);
  const [selectedFood,setSelectedFood]=useState(null);
  const [selectedMeal,setSelectedMeal]=useState(()=>{
    try{const remembered=localStorage.getItem('workset:nutrition:meal:'+userId);
      return MEALS.includes(remembered)?remembered:'Breakfast';}catch{return 'Breakfast'}
  });
  const [lastLoggedMeal,setLastLoggedMeal]=useState('');
  const [portionChoice,setPortionChoice]=useState('default');
  const [customGrams,setCustomGrams]=useState('100');
  const [servings,setServings]=useState('1');
  const [editEntry,setEditEntry]=useState(null);
  const [waterAmount,setWaterAmount]=useState('');
  const [editingWater,setEditingWater]=useState(null);
  const [barcode,setBarcode]=useState('');
  const [scanning,setScanning]=useState(false);
  const [custom,setCustom]=useState(emptyFields);
  const [recipeName,setRecipeName]=useState('');
  const [recipeServings,setRecipeServings]=useState('1');
  const [recipeIngredients,setRecipeIngredients]=useState([]);
  const [ingredient,setIngredient]=useState(emptyFields);
  const [ingredientQty,setIngredientQty]=useState('1');
  const videoRef=useRef(null);
  const newest=useRef(0);
  const searchRequest=useRef(0);
  const foodDetailsRequest=useRef(0);
  const [verifyingFood,setVerifyingFood]=useState(false);
  const searchInputRef=useRef(null);
  const selectionRef=useRef(null);
  const diaryRef=useRef(null);
  const [resultsQuery,setResultsQuery]=useState('');
  const [visibleResults,setVisibleResults]=useState(8);

  useEffect(()=>{
    const cached=cacheFor(userId);setData(cached);setGoals({...cached.preferences});
    ++searchRequest.current;
    try{const last=localStorage.getItem('workset:nutrition:meal:'+userId);
      setSelectedMeal(MEALS.includes(last)?last:'Breakfast')}catch{setSelectedMeal('Breakfast')}
    setLastLoggedMeal('');
    setNotice('');setSelectedFood(null);setEditEntry(null);setResults([]);setResultsQuery('');
  },[userId]);
  useEffect(()=>{
    if(!userId)return;
    writeOfflineState(userId,CACHE_KEY,data);
    try{window.dispatchEvent(new Event('workset:nutrition-change'))}catch{}
  },[data,userId]);
  useEffect(()=>{
    if(!userId)return;
    let cancelled=false;
    const sync=async()=>{
      if(!isOnline()||activeUser.current!==userId)return;
      const sequence=++newest.current;
      setLoading(true);
      try{
        if(getPendingOfflineCount(userId)>0){
          const flushed=await syncOfflineQueue(supabase,userId);
          if(flushed.pending>0)throw new Error('Some offline entries are still waiting to sync.');
        }
        const [prefs,foods,entries,water]=await Promise.all([
          supabase.from(tables.preferences).select('*').eq('user_id',userId).maybeSingle(),
          readAll(tables.foods,userId,'updated_at'),
          readAll(tables.entries,userId,'entry_date'),
          readAll(tables.water,userId,'entry_date')
        ]);
        if(prefs.error)throw prefs.error;
        if(cancelled||sequence!==newest.current||activeUser.current!==userId)return;
        const merged={preferences:prefs.data||{...NUTRITION_DEFAULTS},
          foods,entries,water};
        setData(merged);setGoals({...merged.preferences});
        setNotice('');
      }catch(error){
        if(!cancelled&&activeUser.current===userId)
          setNotice('Saved records remain on this device. '+(error?.message||'Could not refresh right now.'));
      }finally{if(!cancelled&&activeUser.current===userId)setLoading(false)}
    };
    sync();
    window.addEventListener('online',sync);
    window.addEventListener('workset:offline-synced',sync);
    return ()=>{cancelled=true;window.removeEventListener('online',sync);
      window.removeEventListener('workset:offline-synced',sync)};
  },[userId]);

  const save=async(bucket,row)=>{
    if(!userId)return false;
    const table=tables[bucket],id=bucket==='preferences'?'user_id':'id';
    const payload={...row,user_id:userId,updated_at:new Date().toISOString()};
    const response=await upsertOfflineFirst(supabase,{userId,table,payload,onConflict:id,
      dedupeKey:'nutrition:'+table+':'+(payload.id||userId)});
    if(response.error){setNotice('Not saved: '+response.error.message);return false}
    lastOfflineSave.current=Boolean(response.offline);
    if(activeUser.current!==userId)return false;
    setData(previous=>({...previous,
      [bucket]:bucket==='preferences'?payload:updated(previous[bucket],payload)
    }));
    setNotice(response.offline?'✓ Saved on this device. It will sync when you reconnect.':'✓ Saved to your account.');
    return true;
  };
  useEffect(()=>{
    if(!userId||!MEALS.includes(selectedMeal))return;
    try{localStorage.setItem('workset:nutrition:meal:'+userId,selectedMeal)}catch{}
  },[selectedMeal,userId]);
  useEffect(()=>{
    if(view!=='search'||selectedFood)return;
    const frame=requestAnimationFrame(()=>searchInputRef.current?.focus({preventScroll:true}));
    return ()=>cancelAnimationFrame(frame);
  },[view]);
  const prefs={...NUTRITION_DEFAULTS,...data.preferences};
  const today=useMemo(()=>summarizeDay(data.entries,data.water,date),[data.entries,data.water,date]);
  const dayFood=useMemo(()=>data.entries.filter(row=>row.entry_date===date&&!row.deleted_at)
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),[data.entries,date]);
  const dayWater=useMemo(()=>data.water.filter(row=>row.entry_date===date&&!row.deleted_at)
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),[data.water,date]);
  const favoriteFoods=useMemo(()=>data.foods.filter(row=>!row.deleted_at&&row.is_favorite)
    .sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))),[data.foods]);
  const recentFoods=useMemo(()=>{
    const seen=new Set();
    return [...data.entries].filter(row=>!row.deleted_at).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))
      .filter(row=>{const key=row.name+'|'+row.brand;if(seen.has(key))return false;seen.add(key);return true})
      .slice(0,12).map(asFood);
  },[data.entries]);
  const history=useMemo(()=>nutritionHistory(data.entries,data.water,date,30),[data.entries,data.water,date]);
  const history7=history.slice(-7),last30=history;
  const avg=rows=>rows.length?Math.round(rows.reduce((s,r)=>s+r.calories,0)/rows.length):0;
  const selectedOptions=selectedFood?.source==='usda'&&Array.isArray(selectedFood.serving_options)
    ?selectedFood.serving_options.filter(item=>
      item.label!==selectedFood.serving_label||Number(item.grams)!==Number(selectedFood.serving_grams)):[];
  const currentPortion=portionChoice==='custom'?{label:customGrams+' g',grams:Number(customGrams)}:
    portionChoice==='default'?{label:selectedFood?.serving_label,grams:selectedFood?.serving_grams}:
    selectedOptions.find((item,index)=>String(index)===portionChoice);
  const selectedForLog=useMemo(()=>{
    if(!selectedFood)return null;
    if(!currentPortion?.grams||selectedFood.source!=='usda')return selectedFood;
    try{return foodForPortion(selectedFood,currentPortion)}catch{return null}
  },[selectedFood,portionChoice,customGrams]);
  const selectedTotals=selectedForLog&&Number.isFinite(Number(servings))&&Number(servings)>0&&Number(servings)<=1000?
    multipliedNutrients(selectedForLog,servings):null;
  const broaderQuery=broaderFoodSearch(search);
  const restaurantPlan=planFoodSearch(resultsQuery||search);
  const searchRestaurantOnly=Boolean(resultsQuery&&!selectedFood&&!searching&&results.length===0&&restaurantPlan.restaurant&&restaurantPlan.itemTerms.length);
  const totalUsdaGrams=selectedForLog?.source==='usda'&&Number.isFinite(Number(servings))&&Number(servings)>0
    ?Number(selectedForLog.serving_grams||0)*Number(servings):0;
  const selectFood=(food)=>{
    const token=++foodDetailsRequest.current;
    searchInputRef.current?.blur();
    setSelectedFood(food);setEditEntry(null);setServings('1');
    setPortionChoice('default');setCustomGrams('100');setNotice('');
    const usdaId=String(food?.source_id||'');
    if(food?.source==='usda'&&/^[0-9]{1,12}$/.test(usdaId)&&isOnline()){
      setVerifyingFood(true);
      supabase.functions.invoke('nutrition-search',{body:{action:'details',fdcId:usdaId}})
        .then(({data,error})=>{
          if(token!==foodDetailsRequest.current||activeUser.current!==userId)return;
          if(!error&&data?.food?.source==='usda'&&String(data.food.source_id)===usdaId){
            setSelectedFood(data.food);
            setPortionChoice('default');
          }else setNotice('Using available USDA search information. Verify the serving label before logging.');
        })
        .catch(()=>{if(token===foodDetailsRequest.current)setNotice('USDA serving details could not load. Use the listed gram amount.')})
        .finally(()=>{if(token===foodDetailsRequest.current)setVerifyingFood(false)});
    }else setVerifyingFood(false);
    requestAnimationFrame(()=>selectionRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));
  };
  const changeSearch=value=>{
    ++foodDetailsRequest.current;
    ++searchRequest.current; // invalidate any search that is still in flight
    setSearch(value);setResults([]);setResultsQuery('');setSelectedFood(null);
    setEditEntry(null);setVisibleResults(8);setSearching(false);setNotice('');
  };
  const addFood=async()=>{
    if(!selectedForLog||selectedForLog.can_log===false||busy)return;
    setBusy(true);
    try{
      const row=makeFoodEntry(selectedForLog,{id:editEntry?.id||offlineUuid(),userId,date,
        meal:selectedMeal,servings,now:editEntry?.created_at||new Date().toISOString()});
      const result=await save('entries',row);
      if(result){
        ++foodDetailsRequest.current;setVerifyingFood(false);
        setSelectedFood(null);setEditEntry(null);setServings('1');setView('log');
        setLastLoggedMeal(selectedMeal);
        if(!lastOfflineSave.current)setNotice('');
        requestAnimationFrame(()=>diaryRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));
      }
    }catch(error){setNotice(error.message)}finally{setBusy(false)}
  };
  const remove=async(bucket,row)=>{
    if(!await confirmWorkset('Remove this '+(bucket==='water'?'water entry':bucket==='foods'?'saved food':'food entry')+'?',
      {title:'Remove saved nutrition entry?',confirmLabel:'Remove',cancelLabel:'Keep'}))return;
    await save(bucket,{...row,deleted_at:new Date().toISOString()});
  };
  const saveWater=async(oz=waterAmount)=>{
    if(busy)return;
    setBusy(true);
    try{
      const row=makeWaterEntry({id:editingWater?.id||offlineUuid(),userId,date,oz,
        now:editingWater?.created_at||new Date().toISOString()});
      const ok=await save('water',row);
      if(ok){setWaterAmount('');setEditingWater(null)}
    }catch(error){setNotice(error.message)}finally{setBusy(false)}
  };
  const savePreferences=async(next=goals)=>{
    const keys=['calorie_goal','protein_goal','carbs_goal','fat_goal','water_goal_oz'];
    const maximum={calorie_goal:20000,protein_goal:2000,carbs_goal:3000,fat_goal:2000,water_goal_oz:1000};
    if(!keys.every(key=>validNumber(next[key],maximum[key]))||
      Number(next.calorie_goal)<=0||Number(next.water_goal_oz)<=0){
      setNotice('Goals must be valid positive values (macro targets can be zero).');return;
    }
    const payload={user_id:userId,mode:next.mode==='macros'?'macros':'calories',
      ...Object.fromEntries(keys.map(key=>[key,Number(next[key])]))};
    const ok=await save('preferences',payload);
    if(ok)setGoals(payload);
  };
  const startAnother=()=>{
    ++foodDetailsRequest.current;setVerifyingFood(false);
    setLastLoggedMeal('');setSelectedFood(null);setEditEntry(null);
    setSearch('');setResults([]);setResultsQuery('');setNotice('');setView('search');
  };
  const lookup=async(mode='search',override='')=>{
    if(searching)return;
    const token=++searchRequest.current;
    const term=String(override||search).trim();
    if(override)setSearch(term);
    setResults([]);setResultsQuery('');setSelectedFood(null);setEditEntry(null);
    setVisibleResults(8);setSearching(true);setNotice('');
    searchInputRef.current?.blur();
    try{
      if(mode==='barcode'){
        const found=await lookupFoodBarcode(barcode);
        if(token!==searchRequest.current)return;
        setResults([found]);setResultsQuery('Barcode lookup');
        selectFood(found);setView('search');
      }else{
        const found=await searchAllFoodCatalog(term,{supabaseClient:supabase});
        if(token!==searchRequest.current)return; // ignore stale responses
        setResults(found);setResultsQuery(term);
        if(found.length&&found[0].cached)setNotice('Showing previously found foods saved on this device. Verify package labels before logging.');
        else if(!found.length){
          const plan=planFoodSearch(term);
          setNotice(plan.restaurant&&plan.itemTerms.length
            ?'No matching '+plan.itemTerms.join(' ')+' item found for '+plan.restaurant+'. You can search the restaurant menu more broadly or enter a custom food.'
            :'No closely matching foods found for "'+term+'". Try a simpler food name or enter a custom food.');
        }
      }
    }catch(error){
      if(token===searchRequest.current){setResults([]);setResultsQuery('');setNotice(error?.message||'Food search unavailable. Enter a custom food.')}
    }finally{if(token===searchRequest.current)setSearching(false)}
  };
  const saveFavorite=async(food)=>{
    if(!food||!food.name||food.can_log===false)return;
    const previous=data.foods.find(row=>!row.deleted_at&&row.name===food.name&&row.brand===(food.brand||'')&&
      row.source===String(food.source||'manual')&&row.source_id===String(food.source_id||''));
    if(previous){setNotice('This food is already in your favorites.');return}
    await save('foods',cleanFood(food,userId));
  };
  const saveCustom=async()=>{
    if(!validCustom(custom)){setNotice('Enter a food name and valid calories/macros.');return}
    const food=cleanFood({...custom,source:'manual'},userId);
    if(await save('foods',food)){setCustom(emptyFields());selectFood(food);setView('search')}
  };
  const addIngredient=(food,qty)=>{
    try{
      const nutrition=multipliedNutrients(food,qty);
      setRecipeIngredients(items=>[...items,{id:offlineUuid(),name:food.name,quantity:Number(qty),...nutrition}]);
      setNotice('Ingredient added to recipe.');
    }catch(error){setNotice(error.message)}
  };
  const saveMeal=async(meal)=>{
    const items=dayFood.filter(row=>row.meal===meal);
    if(!items.length)return;
    const name=await promptWorkset('Name this reusable meal',meal+' meal');
    if(!String(name||'').trim())return;
    const food=cleanFood({...nutrientSum(items),name:String(name).trim(),serving_label:'1 meal',
      source:'meal',is_recipe:true,ingredients:items.map(row=>({
        name:row.name,quantity:row.quantity,calories:row.calories,
        protein_g:row.protein_g,carbs_g:row.carbs_g,fat_g:row.fat_g
      }))},userId);
    await save('foods',food);
  };
  const saveRecipe=async()=>{
    if(!String(recipeName).trim()){setNotice('Name the recipe.');return}
    try{
      const nutrition=recipePerServing(recipeIngredients,recipeServings);
      const food=cleanFood({name:recipeName,serving_label:'1 recipe serving',source:'recipe',
        is_recipe:true,ingredients:recipeIngredients,...nutrition},userId);
      if(await save('foods',food)){setRecipeName('');setRecipeIngredients([]);setRecipeServings('1');
        selectFood(food);setView('search')}
    }catch(error){setNotice(error.message)}
  };
  useEffect(()=>{
    if(!scanning)return;
    let cancelled=false,stream=null,timer=null;
    const start=async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera scanning is not available here. Enter the barcode instead.');
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(cancelled){stream.getTracks().forEach(track=>track.stop());return}
        const video=videoRef.current;
        if(!video)throw new Error('Camera preview is unavailable.');
        video.srcObject=stream;await video.play();
        const Detector=globalThis.BarcodeDetector||BarcodeDetectorPonyfill;
        const detector=new Detector({formats:['ean_13','ean_8','upc_a','upc_e']});
        const scan=async()=>{
          if(cancelled)return;
          try{
            const codes=await detector.detect(video);
            const value=codes?.find(code=>/^[0-9]{8,14}$/.test(code.rawValue||''))?.rawValue;
            if(value){
              setBarcode(value);setScanning(false);setSearching(true);
              try{const food=await lookupFoodBarcode(value);setResults([food]);selectFood(food);setView('search')}
              catch(error){setNotice(error.message)}finally{setSearching(false)}
              return;
            }
          }catch(error){if(error?.name==='NotSupportedError'){setNotice('Camera barcode detection is unavailable. Enter the code below.');setScanning(false);return}}
          timer=setTimeout(scan,220);
        };
        scan();
      }catch(error){setNotice(error?.message||'Camera could not open.');setScanning(false)}
    };
    start();
    return ()=>{cancelled=true;clearTimeout(timer);
      if(stream)stream.getTracks().forEach(track=>track.stop());
      if(videoRef.current)videoRef.current.srcObject=null};
  },[scanning]);

  if(!userId)return <section className="page-section">Sign in to track nutrition.</section>;
  return <section className="page-section nutrition-page" aria-label="Nutrition and hydration">
    <div className="nutrition-topline"><button type="button" className="secondary-action" onClick={onBack}>← Back</button>
      <span>{loading?'Syncing nutrition…':isOnline()?'Private to your account':'Offline logging available'}</span></div>
    {view==='search'?
      <div className="nutrition-search-intro">
        <div><span className="card-label">QUICK FOOD LOG</span><strong>Adding to {selectedMeal}</strong></div>
        <button type="button" onClick={()=>{setSelectedFood(null);setEditEntry(null);setView('log')}}>← Diary</button>
      </div>
    :<>
    <div className="nutrition-hero"><span className="card-label">FOOD & WATER</span><h2>Nutrition & hydration</h2>
      <p>Log meals and water your way. Calories and macros are always saved, even when you change modes.</p>
    </div>
    <div className="nutrition-date-picker"><button type="button" onClick={()=>setDate(dayShift(date,-1))} aria-label="Previous day">‹</button>
      <label>Tracking date<input type="date" value={date} onChange={e=>setDate(e.target.value||dateKey())}/></label>
      <button type="button" onClick={()=>setDate(dayShift(date,1))} aria-label="Next day">›</button>
      <button type="button" className="nutrition-today-jump" onClick={()=>setDate(dateKey())}>Today</button>
    </div>
    <div className="nutrition-mode" aria-label="Tracking mode">
      <button type="button" className={prefs.mode==='calories'?'active':''} aria-pressed={prefs.mode==='calories'}
        onClick={()=>savePreferences({...prefs,mode:'calories'})}>Calories</button>
      <button type="button" className={prefs.mode==='macros'?'active':''} aria-pressed={prefs.mode==='macros'}
        onClick={()=>savePreferences({...prefs,mode:'macros'})}>Macros</button>
    </div>
    <div className="nutrition-summary">
      {prefs.mode==='calories'?<>
        <div className="nutrition-calorie-hero"><div><small>CALORIES LEFT</small><strong>{fmt(Math.max(0,prefs.calorie_goal-today.calories))}</strong>
          <span>{fmt(today.calories)} eaten · {fmt(prefs.calorie_goal)} goal</span></div>
          <span className="nutrition-energy-unit">kcal</span></div>
        <ProgressMetric label="Calories" value={today.calories} goal={prefs.calorie_goal} unit="kcal" primary/>
      </>:<div className="nutrition-calorie-compact">Calories from logged foods <strong>{fmt(today.calories)} kcal</strong></div>}
      <div className="nutrition-macros">
        <ProgressMetric label="Protein" value={today.protein_g} goal={prefs.protein_goal} unit="g" primary={prefs.mode==='macros'}/>
        <ProgressMetric label="Carbs" value={today.carbs_g} goal={prefs.carbs_goal} unit="g" primary={prefs.mode==='macros'}/>
        <ProgressMetric label="Fat" value={today.fat_g} goal={prefs.fat_goal} unit="g" primary={prefs.mode==='macros'}/>
      </div>
    </div>
    <section className="nutrition-water-card"><div className="nutrition-card-heading"><div><span className="card-label">HYDRATION</span>
      <h3>Water <small>{fmt(today.water_oz)} / {fmt(prefs.water_goal_oz)} oz</small></h3></div></div>
      <ProgressMetric label="Daily water" value={today.water_oz} goal={prefs.water_goal_oz} unit="oz"/>
      <div className="nutrition-water-actions">{[8,12,16,24].map(oz=><button type="button" key={oz} disabled={busy}
        onClick={()=>saveWater(oz)}>+ {oz} oz</button>)}</div>
      <form className="nutrition-inline-form" onSubmit={e=>{e.preventDefault();saveWater()}}>
        <label>{editingWater?'Edit water amount':'Custom amount (oz)'}<input type="number" inputMode="decimal" step="0.1" min="0.1" max="256"
          value={waterAmount} onChange={e=>setWaterAmount(e.target.value)} placeholder="Amount in oz"/></label>
        <button type="submit" className="primary-action" disabled={busy}>{editingWater?'Save edit':'Add water'}</button>
        {editingWater&&<button type="button" onClick={()=>{setEditingWater(null);setWaterAmount('')}}>Cancel</button>}
      </form>
      {dayWater.length>0&&<details className="nutrition-water-entries"><summary>Water entries ({dayWater.length})</summary>
        {dayWater.map(row=><div key={row.id}><span>{fmt(row.amount_oz)} oz</span>
          <button type="button" onClick={()=>{setEditingWater(row);setWaterAmount(String(row.amount_oz))}}>Edit</button>
          <button type="button" onClick={()=>remove('water',row)}>Remove</button></div>)}</details>}
    </section>
    </>}

    <div className="nutrition-tabs" role="group" aria-label="Nutrition tools">
      {[['log','Food diary'],['search','Add food'],['saved','Saved'],['recipe','Recipes'],['history','History'],['goals','Goals']].map(([key,label])=>
        <button type="button" key={key} className={view===key?'active':''} aria-pressed={view===key} onClick={()=>{setNotice('');setView(key)}}>{label}</button>)}
    </div>
    {notice&&<p className="nutrition-status" role="status">{notice}</p>}

    {view==='log'&&<section ref={diaryRef} className="nutrition-food-diary">
      {lastLoggedMeal&&<div className="nutrition-added">
        <strong>✓ Added to {lastLoggedMeal}</strong>
        <div>
          <button type="button" onClick={startAnother}>Add another</button>
          <button type="button" onClick={()=>setLastLoggedMeal('')}>Done</button>
        </div>
      </div>}
      {dayFood.some(needsNutritionReview)&&<p className="nutrition-review-alert" role="status">
        Some earlier USDA entries have calorie totals that conflict with their macros.
        Review them against a trusted source; WorkSet has not changed your recorded history.
      </p>}
      {MEALS.map(meal=>{
        const items=dayFood.filter(row=>row.meal===meal);
        return <div className="nutrition-meal" key={meal}><div className="nutrition-card-heading"><h3>{meal}</h3>
          <div className="nutrition-meal-actions">{items.length>0&&<button type="button" onClick={()=>saveMeal(meal)}>Save meal</button>}
          <button type="button" onClick={()=>{setSelectedMeal(meal);setLastLoggedMeal('');setSelectedFood(null);setNotice('');setView('search')}}>+ Add</button></div></div>
          {items.length?items.map(row=><div className="nutrition-entry" key={row.id}>
            <div><strong>{row.name}</strong><small>{fmt(row.quantity)} × {row.serving_label} · P {fmt(row.protein_g)} / C {fmt(row.carbs_g)} / F {fmt(row.fat_g)} g</small>
            {needsNutritionReview(row)&&<small className="nutrition-review-tag">⚠ Verify USDA nutrition</small>}</div>
            <div><b>{fmt(row.calories)} kcal</b><span><button type="button" onClick={()=>{
              setSelectedMeal(row.meal);setSelectedFood(asFood({...row,id:row.food_id}));
              setEditEntry(row);setServings(String(row.quantity));setView('search');
            }}>Edit</button><button type="button" onClick={()=>remove('entries',row)}>Remove</button></span></div>
          </div>):<p className="nutrition-empty">No food added yet.</p>}
        </div>
      })}
    </section>}

    {view==='search'&&<section className="nutrition-tool-card">
      <h3>Find a food</h3>
      <p className="nutrition-help nutrition-search-help">Common foods, restaurants and packaged products in one place.</p>
      <form className="nutrition-search" onSubmit={e=>{e.preventDefault();lookup()}}>
        <input ref={searchInputRef} type="search" value={search} onChange={e=>changeSearch(e.target.value)} placeholder="Search food or restaurant" aria-label="Food search" autoComplete="off" spellCheck={false}/>
        <button type="submit" className="primary-action" disabled={searching}>{searching?'Searching…':'Search'}</button>
      </form>
      <details className="nutrition-barcode-details"><summary>Scan barcode or enter a code</summary>
      <div className="nutrition-barcode"><input inputMode="numeric" value={barcode} onChange={e=>setBarcode(e.target.value)}
        placeholder="8–14 digit barcode" aria-label="Product barcode"/>
        <button type="button" disabled={searching} onClick={()=>lookup('barcode')}>Look up</button>
        <button type="button" onClick={()=>setScanning(s=>!s)}>{scanning?'Stop camera':'Scan camera'}</button></div></details>
      {scanning&&<div className="nutrition-camera"><video ref={videoRef} autoPlay playsInline muted/><small>Center a product barcode in the camera. No photos are saved.</small></div>}
      {selectedFood&&<div className="nutrition-selection-panel" ref={selectionRef}>
        {verifyingFood&&<small className="nutrition-checking">Checking USDA serving details…</small>}
        <div className="nutrition-selection-top">
          <strong>Selected food</strong>
          <button type="button" onClick={()=>{setSelectedFood(null);setEditEntry(null)}}>← Back to results</button>
        </div>
        {selectedFood?.can_log===false?<div className="nutrition-selection nutrition-provider-preview">
        <h4>{selectedFood.name}{selectedFood.brand?' · '+selectedFood.brand:''}</h4>
        <p>{selectedFood.description||selectedFood.validation_warning||'This entry cannot be logged without verified nutrition details.'}</p>
        <p className="nutrition-caution">{selectedFood.source==='fatsecret'
          ?'FatSecret entries are previews only under its storage license. Use a USDA match or add your own food.'
          :'USDA nutrition values need verification. Try a different result or enter a custom food using the package label.'}</p>
        {selectedFood.source_url&&<a href={selectedFood.source_url} target="_blank" rel="noopener noreferrer">View on FatSecret</a>}
        <button type="button" onClick={()=>setSelectedFood(null)}>Close preview</button>
      </div>:selectedFood&&<div className="nutrition-selection">
        <h4>{editEntry?'Edit food entry':'Log '+selectedFood.name}</h4>
        <p className="nutrition-live-totals">{selectedTotals?
          fmt(selectedTotals.calories)+' kcal · P '+fmt(selectedTotals.protein_g)+' / C '+fmt(selectedTotals.carbs_g)+' / F '+fmt(selectedTotals.fat_g)+' g':
          'Enter a valid portion and amount to see nutrition.'}</p>
        {selectedFood.incomplete&&<p className="nutrition-caution">Some nutrients are missing from the public food record. Verify the package label.</p>}
        {selectedFood.source==='usda'&&totalUsdaGrams>0&&<p className="nutrition-weight-note">
          {fmt(servings)} × {selectedForLog?.serving_label||selectedFood.serving_label} = {fmt(totalUsdaGrams)} g total.
          {(selectedForLog?.serving_label||'').trim().toLowerCase()==='100 g'&&
            ' This is a weight-based amount, not a count of minis, slices, or pieces.'}
        </p>}
        {selectedFood.source==='usda'&&<label className="nutrition-portion-label">Serving size
          <select aria-label="Serving size" value={portionChoice} onChange={e=>setPortionChoice(e.target.value)}>
            <option value="default">{selectedFood.serving_label}</option>
            {selectedOptions.map((item,index)=>
              <option key={index} value={String(index)}>{item.label}</option>)}
            <option value="custom">Custom grams</option>
          </select>
        </label>}
        {portionChoice==='custom'&&<label>Grams
          <input type="number" inputMode="decimal" min="1" max="1500" step="1"
            value={customGrams} onChange={e=>setCustomGrams(e.target.value)}/>
        </label>}
        <div className="nutrition-serving-fields"><label>Meal<select value={selectedMeal} onChange={e=>setSelectedMeal(e.target.value)}>
          {MEALS.map(meal=><option key={meal}>{meal}</option>)}</select></label>
          <label>Amount
            <div className="nutrition-quantity">
              <button type="button" aria-label="Decrease servings" onClick={()=>setServings(old=>String(Math.max(.25,Number((Number(old)-.25).toFixed(2))||.25)))}>−</button>
              <input type="number" inputMode="decimal" min="0.01" max="1000" step="0.25" aria-label="Servings"
                value={servings} onChange={e=>setServings(e.target.value)}/>
              <button type="button" aria-label="Increase servings" onClick={()=>setServings(old=>String(Math.min(1000,Number((Number(old)+.25).toFixed(2))||1)))}>+</button>
            </div>
          </label></div>
        <div className="nutrition-choice-actions nutrition-log-primary">
          <button type="button" className="primary-action" disabled={busy||verifyingFood||!selectedTotals} onClick={addFood}>{busy?'Saving…':editEntry?'Save changes':'Log food'}</button>
        </div>
        <details className="nutrition-secondary-actions"><summary>More options</summary>
          <div>
            <button type="button" onClick={()=>saveFavorite(selectedFood)}>☆ Save favorite</button>
            <button type="button" onClick={()=>{addIngredient(selectedForLog||selectedFood,servings);setView('recipe')}}>+ Recipe ingredient</button>
          </div>
        </details>
      </div>}
      </div>}
      {!selectedFood&&broaderQuery&&<div className="nutrition-search-suggestion">
        <span>Looking for a restaurant or menu item?</span>
        <button type="button" onClick={()=>lookup('search',broaderQuery)}>
          Search “{broaderQuery}”
        </button>
      </div>}
      
            {searchRestaurantOnly&&<div className="nutrition-search-suggestion">
        <span>The specific item wasn't found in the connected food databases.</span>
        <button type="button" onClick={()=>lookup('search',restaurantPlan.restaurant)}>
          Search {restaurantPlan.restaurant} instead
        </button>
      </div>}
            {results.length>0&&!selectedFood&&<div className="nutrition-results-block">
        <div className="nutrition-results-top"><strong>Results for "{resultsQuery||search}"</strong><small>{results.length} matches</small></div>
        <div className="nutrition-results" aria-label="Food results">
          {results.slice(0,visibleResults).map((food,i)=>
            <button type="button" key={(food.source||'')+':'+(food.source_id||food.name)+i}
              onClick={()=>selectFood(food)}>
              <strong>{food.name}</strong>
              <small>{foodSourceLabel(food)}{food.brand?' · '+food.brand:''}{food.can_log===false?' · Preview only':' · '+fmt(food.calories)+' kcal / '+food.serving_label}{food.source==='usda'&&food.serving_label?.trim().toLowerCase()==='100 g'?' (weight)':''}{food.incomplete?' · Check nutrition label':''}</small>
            </button>)}
        </div>
        {results.length>visibleResults&&<button type="button" className="nutrition-more-results"
          onClick={()=>setVisibleResults(value=>Math.min(value+8,results.length))}>
          Show more ({results.length-visibleResults} remaining)
        </button>}
        {results.some(food=>food.source==='fatsecret')&&
          <p className="nutrition-provider-attribution"><a href="https://platform.fatsecret.com">Powered by fatsecret Platform API</a></p>}
      </div>}
      {!selectedFood&&!search.trim()&&!results.length&&<div className="nutrition-suggestions nutrition-common-foods">
        <span>Common searches</span>
        <div>{['Egg','Chicken breast','Rice','Banana'].map(term=>
          <button type="button" key={term} onClick={()=>lookup('search',term)}>{term}</button>)}</div>
      </div>}
            {!selectedFood&&results.length===0&&recentFoods.length>0&&<div className="nutrition-suggestions"><span>Recently logged</span><div>{recentFoods.map((food,i)=>
        <button type="button" key={i} onClick={()=>selectFood(food)}>{food.name}</button>)}</div></div>}
      {!selectedFood&&results.length===0&&favoriteFoods.length>0&&<div className="nutrition-suggestions"><span>Saved foods</span><div>{favoriteFoods.slice(0,12).map(food=>
        <button type="button" key={food.id} onClick={()=>selectFood(food)}>{food.name}</button>)}</div></div>}
      <details className="nutrition-custom" open={false}><summary>+ Create custom food</summary>
        <div className="nutrition-custom-fields">
          {Object.keys(custom).map(key=><label key={key}>{({name:'Food name',brand:'Brand (optional)',serving_label:'Serving description',
            calories:'Calories',protein_g:'Protein (g)',carbs_g:'Carbs (g)',fat_g:'Fat (g)'})[key]}
            <input type={['name','brand','serving_label'].includes(key)?'text':'number'} min="0" step="0.1" inputMode="decimal"
              value={custom[key]} onChange={e=>setCustom(old=>({...old,[key]:e.target.value}))}/></label>)}
          <button type="button" className="primary-action" onClick={saveCustom}>Save custom food</button>
        </div>
      </details>
    </section>}

    {view==='saved'&&<section className="nutrition-tool-card"><h3>Favorite foods & meals</h3>
      <p className="nutrition-help">Your saved foods and recipes work without an internet connection.</p>
      {favoriteFoods.length===0?<p className="nutrition-empty">No favorites yet. Add foods from the Search tab.</p>:
        favoriteFoods.map(food=><div className="nutrition-saved-row" key={food.id}>
          <div><strong>{food.name}</strong><small>{food.is_recipe?'Recipe · ':''}{fmt(food.calories)} kcal · {food.serving_label}</small></div>
          <div><button type="button" onClick={()=>{selectFood(food);setView('search')}}>Log</button>
            <button type="button" onClick={()=>remove('foods',food)}>Remove</button></div></div>)}
    </section>}

    {view==='recipe'&&<section className="nutrition-tool-card"><h3>Recipe builder</h3>
      <p className="nutrition-help">Add ingredients with their nutrition values. Save the recipe once and log it by servings.</p>
      <div className="nutrition-serving-fields"><label>Recipe name<input value={recipeName} onChange={e=>setRecipeName(e.target.value)}
        placeholder="Homemade chili"/></label><label>Number of servings<input type="number" inputMode="numeric" min="1" max="100" step="1"
        value={recipeServings} onChange={e=>setRecipeServings(e.target.value)}/></label></div>
      <div className="nutrition-recipe-ingredients">
        {recipeIngredients.map(row=><div key={row.id}><div><strong>{row.name}</strong><small>{fmt(row.calories)} kcal · P {fmt(row.protein_g)} / C {fmt(row.carbs_g)} / F {fmt(row.fat_g)}</small></div>
          <button type="button" onClick={()=>setRecipeIngredients(old=>old.filter(item=>item.id!==row.id))}>Remove</button></div>)}
      </div>
      <div className="nutrition-custom-fields">
        <h4>Add ingredient manually</h4>
        {Object.keys(ingredient).filter(key=>key!=='brand'&&key!=='serving_label').map(key=><label key={key}>
          {({name:'Ingredient name',calories:'Calories',protein_g:'Protein (g)',carbs_g:'Carbs (g)',fat_g:'Fat (g)'})[key]}
          <input type={key==='name'?'text':'number'} min="0" step="0.1" value={ingredient[key]}
            onChange={e=>setIngredient(old=>({...old,[key]:e.target.value}))}/></label>)}
        <label>Amount multiplier<input type="number" inputMode="decimal" min="0.01" step="0.01" value={ingredientQty}
          onChange={e=>setIngredientQty(e.target.value)}/></label>
        <button type="button" onClick={()=>{if(!validCustom(ingredient)){setNotice('Enter a name and valid nutrition values.');return}
          addIngredient(ingredient,ingredientQty);setIngredient(emptyFields());setIngredientQty('1')}}>+ Add ingredient</button>
      </div>
      {recipeIngredients.length>0&&<p className="nutrition-recipe-total">
        Total recipe: {fmt(recipeIngredients.reduce((sum,row)=>sum+row.calories,0))} kcal / {recipeServings||'1'} servings
      </p>}
      <button type="button" className="primary-action" disabled={!recipeName.trim()||!recipeIngredients.length} onClick={saveRecipe}>Save recipe to favorites</button>
    </section>}

    {view==='history'&&<section className="nutrition-tool-card"><h3>Nutrition history</h3>
      <div className="nutrition-history-summary"><div><small>7-day average</small><strong>{avg(history7)} kcal/day</strong></div>
        <div><small>30-day average</small><strong>{avg(last30)} kcal/day</strong></div></div>
      <div className="nutrition-history-list">{history.slice().reverse().map(row=><button type="button" key={row.date}
        onClick={()=>{setDate(row.date);setView('log')}}>
        <strong>{row.date}</strong><span>{fmt(row.calories)} kcal · P {fmt(row.protein_g)} g · Water {fmt(row.water_oz)} oz</span>
      </button>)}</div>
      <p className="nutrition-help">Days without entries count as zero in these averages. Select a date to review or edit its logs.</p>
    </section>}

    {view==='goals'&&<section className="nutrition-tool-card"><h3>Your daily goals</h3>
      <p className="nutrition-help">These are editable starting values, not medical recommendations. Choose Calories or Macros above at any time.</p>
      <div className="nutrition-goal-fields">{[['calorie_goal','Calories (kcal)'],['protein_goal','Protein (g)'],
        ['carbs_goal','Carbs (g)'],['fat_goal','Fat (g)'],['water_goal_oz','Water (oz)']].map(([key,label])=>
        <label key={key}>{label}<input type="number" inputMode="decimal" min="0" max="20000" step="0.1"
          value={goals[key]??''} onChange={e=>setGoals(current=>({...current,[key]:e.target.value}))}/></label>)}</div>
      <button type="button" className="primary-action" onClick={()=>savePreferences(goals)}>Save daily goals</button>
      <p className="nutrition-help">Your nutrition and hydration records are private, included in your account backup, and synced when online.</p>
    </section>}
  </section>;
}
