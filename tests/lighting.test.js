import {test} from 'node:test';
import assert from 'node:assert/strict';
import {echoLightData,syncEchoLighting,lightAnimationChoices} from '../echo-knight/scripts/lighting.js';
test('native light defaults are off and settings use valid Foundry fields',()=>{
  globalThis.CONFIG={Canvas:{lightAnimations:{torch:{label:'Torch'}}}};
  let values={};globalThis.game={settings:{get:(id,key)=>values[key]},i18n:{localize:x=>x}};
  assert.deepEqual(echoLightData(),{dim:0,bright:0,angle:360,color:null,alpha:0.5,animation:{type:null,speed:5,intensity:5,reverse:false}});
  values={lightDim:30,lightBright:15,lightColor:'#20aaee',lightAngle:90,lightAlpha:0.7,lightAnimation:'torch',lightSpeed:3};
  const light=echoLightData();assert.equal(light.dim,30);assert.equal(light.bright,15);assert.equal(light.color,'#20aaee');assert.equal(light.animation.type,'torch');assert.equal(light.angle,90);
  assert.deepEqual(lightAnimationChoices(),{'':'None',torch:'Torch'});
  values={lightDim:-30,lightAngle:700,lightAlpha:4,lightColor:'bad',lightAnimation:'missing'};
  assert.equal(echoLightData().dim,0);assert.equal(echoLightData().angle,360);assert.equal(echoLightData().alpha,1);assert.equal(echoLightData().color,null);assert.equal(echoLightData().animation.type,null);
});
test('migrates only echo tint, updates lighting, and preserves per-token edits on reload',async()=>{
  const stored={};const echo={id:'echo',texture:{tint:'#b8c4d8'},getFlag:(id,key)=>key==='echo'?{sourceId:'knight'}:stored[key]};
  const knight={id:'knight',getFlag:()=>undefined};const writes=[];
  const scene={tokens:[echo,knight],updateEmbeddedDocuments:async(type,updates)=>{writes.push(updates);for(const [key,value] of Object.entries(updates[0])){if(key.startsWith('flags.echo-knight.'))stored[key.split('.').at(-1)]=value;}}};
  globalThis.game={user:{id:'gm'},users:{activeGM:{id:'gm'}},settings:{get:()=>undefined},scenes:[scene]};
  await syncEchoLighting();assert.equal(writes[0].length,1);assert.equal(writes[0][0]['texture.tint'],'#ffffff');assert.equal(writes[0][0]['light.dim'],0);
  await syncEchoLighting();assert.equal(writes.length,1);
  await syncEchoLighting(true);assert.equal(writes.length,2);assert.equal(writes[1][0]['texture.tint'],undefined);
  game.user.id='player';await syncEchoLighting(true);assert.equal(writes.length,2);
});
