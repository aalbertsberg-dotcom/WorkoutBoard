// Optional adult calorie and macro estimates. No goal changes occur until
// the user explicitly applies and saves an estimate. This is not medical advice.
export const ACTIVITY_FACTORS=Object.freeze({
  sedentary:1.2,light:1.375,moderate:1.55,very_active:1.725
});
export const ACTIVITY_LABELS=Object.freeze({
  sedentary:'Mostly seated / little exercise',
  light:'Light activity (1–3 days/week)',
  moderate:'Moderate activity (3–5 days/week)',
  very_active:'Very active (6–7 days/week)'
});
export const WEIGHT_GOALS=Object.freeze({lose:'Lose weight',maintain:'Maintain weight',gain:'Gain weight'});

export const heightFeetInchesToCm=(feet,inches)=>{
  const f=Number(feet),i=Number(inches);
  if(!Number.isInteger(f)||f<3||f>8||!Number.isFinite(i)||i<0||i>=12)return null;
  const cm=(f*12+i)*2.54;
  return Math.round(cm*10)/10;
};
export const cmToHeight=cm=>{
  const total=Number(cm)/2.54;
  if(!Number.isFinite(total)||total<36||total>110)return {feet:'',inches:''};
  return {feet:String(Math.floor(total/12)),inches:String(Math.round((total%12)*10)/10)};
};

export function estimateNutritionTargets(input){
  const age=Number(input?.age_years),height=Number(input?.height_cm),weightLb=Number(input?.weight_lb);
  const sex=input?.sex_for_estimate;
  const activity=ACTIVITY_FACTORS[input?.activity_level];
  const direction=input?.weight_goal;
  if(!Number.isInteger(age)||age<18||age>100)throw new Error('Enter an age between 18 and 100.');
  if(!Number.isFinite(height)||height<90||height>260)throw new Error('Enter a valid height.');
  if(!Number.isFinite(weightLb)||weightLb<45||weightLb>800)throw new Error('Enter a valid bodyweight in pounds.');
  if(!['male','female'].includes(sex))throw new Error('Choose the equation used for the estimate.');
  if(!activity)throw new Error('Choose an activity level.');
  if(!Object.hasOwn(WEIGHT_GOALS,direction))throw new Error('Choose lose, maintain or gain.');
  const kg=weightLb/2.2046226218;
  // Mifflin-St Jeor 1990 resting metabolic rate (adult estimate).
  const resting=10*kg+6.25*height-5*age+(sex==='male'?5:-161);
  const maintenance=resting*activity;
  const adjusted=maintenance+(direction==='lose'?-300:direction==='gain'?200:0);
  const calories=Math.round(adjusted/10)*10;
  if(calories<1200||calories>6000)throw new Error('This estimate falls outside the supported range. Use manual goals or seek individualized guidance.');
  const protein=Math.round(1.6*kg);
  const fat=Math.round(calories*.25/9);
  const carbs=Math.max(0,Math.round((calories-4*protein-9*fat)/4));
  return {
    resting_kcal:Math.round(resting),maintenance_kcal:Math.round(maintenance),
    calorie_goal:calories,protein_goal:protein,carbs_goal:carbs,fat_goal:fat,
    // User should review suggestions rather than treating calculated targets as prescriptions.
    method:'Mifflin-St Jeor',estimated:true
  };
}
