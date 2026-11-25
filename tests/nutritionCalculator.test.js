import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITY_FACTORS,cmToHeight,heightFeetInchesToCm,estimateNutritionTargets}
  from '../src/nutritionCalculator.js';

const info={height_cm:175,age_years:35,weight_lb:190,sex_for_estimate:'male',
 activity_level:'moderate',weight_goal:'maintain'};
test('height is stored as centimeters, with practical feet/inches entry',()=>{
 assert.equal(heightFeetInchesToCm(5,10),177.8);
 assert.deepEqual(cmToHeight(177.8),{feet:'5',inches:'10'});
 assert.equal(heightFeetInchesToCm(5,12),null);
 assert.equal(heightFeetInchesToCm(0,10),null);
});
test('Mifflin-St Jeor adult estimate uses height age weight and formula choice',()=>{
 const result=estimateNutritionTargets(info);
 const kg=190/2.2046226218;
 const expectedRmr=Math.round(10*kg+6.25*175-5*35+5);
 assert.equal(result.resting_kcal,expectedRmr);
 assert.equal(result.maintenance_kcal,Math.round(expectedRmr*ACTIVITY_FACTORS.moderate));
 assert.ok(result.calorie_goal>result.resting_kcal);
 assert.ok(result.protein_goal>0&&result.fat_goal>0&&result.carbs_goal>0);
});
test('Weight loss and gain suggestions do not change maintain estimate implicitly',()=>{
 const maintain=estimateNutritionTargets(info);
 const lose=estimateNutritionTargets({...info,weight_goal:'lose'});
 const gain=estimateNutritionTargets({...info,weight_goal:'gain'});
 assert.equal(maintain.calorie_goal-lose.calorie_goal,300);
 assert.equal(gain.calorie_goal-maintain.calorie_goal,200);
 assert.equal(info.weight_goal,'maintain');
});
test('No personal estimate without meaningful input, including formula selection',()=>{
 for(const modified of [
  {...info,height_cm:null},{...info,age_years:''},{...info,weight_lb:0},
  {...info,sex_for_estimate:null},{...info,activity_level:'unknown'},
  {...info,age_years:17}
 ])assert.throws(()=>estimateNutritionTargets(modified),/Enter|Choose/);
});
test('Calculator is an estimate; low-support values never create extreme automated targets',()=>{
 assert.throws(()=>estimateNutritionTargets({...info,weight_lb:45,height_cm:100,age_years:95,sex_for_estimate:'female',weight_goal:'lose'}),/outside the supported range/);
});
