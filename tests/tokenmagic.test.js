import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePortfolio,SPECTRAL,syncEchoFilter,discoverPortfolio,effectChoices} from '../echo-knight/scripts/tokenmagic.js';
test('reads spectral portfolio parameters including hex, comments and trailing commas',()=>{
  const p=parsePortfolio(`let params = [{filterType:'liquid', color:0x20AAEE, spectral:true, animated:{time:{active:true,speed:0.0010,animType:'move',},},}]; await TokenMagic.addUpdateFiltersOnSelected(params);`);
  assert.equal(p[0].color,0x20AAEE);assert.equal(p[0].animated.time.speed,0.001);
  assert.equal(SPECTRAL[0].animated.color.loopDuration,6000);assert.equal(SPECTRAL[0].blend,8);
});
test('never executes expressions or macro commands',()=>{
  globalThis.executed=false;
  assert.throws(()=>parsePortfolio('const params = [{filterType:"liquid", color: (globalThis.executed = true)}];'));
  assert.throws(()=>parsePortfolio('let params = [{filterType:"liquid", __proto__: {evil: true}}];'));
  assert.throws(()=>parsePortfolio('let params = [] .map(evil);'));
  assert.equal(globalThis.executed,false);
});
test('applies only to the echo and removes only owned filter IDs when disabled',async()=>{
  let enabled=true,stored;const calls=[];
  globalThis.game={user:{id:'gm'},users:{activeGM:{id:'gm'}},modules:new Map([['tokenmagic',{active:true}]]),settings:{get:(id,key)=>key==='tokenMagicEnabled'?enabled:'spectral'}};
  const object={id:'echo'};
  const doc={uuid:'s.echo',object,getFlag:(id,key)=>key==='echo'?{sourceId:'knight'}:stored,setFlag:async(id,key,value)=>stored=value,unsetFlag:async()=>stored=undefined};
  globalThis.TokenMagic={addUpdateFilters:async(token,params)=>calls.push(['add',token,params]),deleteFilters:async(token,id)=>calls.push(['delete',token,id]),addUpdateFiltersOnSelected:()=>{throw Error('Do not change selected tokens')}};
  await syncEchoFilter(doc);assert.equal(calls.length,1);assert.equal(calls[0][1],object);assert.equal(calls[0][2][0].filterId,'echo-knight-body-0');
  assert.equal(calls[0][2][0].color,SPECTRAL[0].color);
  await syncEchoFilter(doc);assert.equal(calls.length,1);
  enabled=false;await syncEchoFilter(doc);assert.deepEqual(calls[1],['delete',object,'echo-knight-body-0']);assert.equal(stored,undefined);
  await syncEchoFilter({...doc,getFlag:()=>undefined});assert.equal(calls.length,2);
});
test('discovers portfolio choices without loading or executing macro scripts',async()=>{
  globalThis.game={packs:[{documentName:'Macro',collection:'tokenmagic.tmfx-macros',metadata:{label:'TokenMagic Portfolio'},getIndex:async()=>[{_id:'spectralMacro',name:'26 - T01 - Spectral Body (liquid)'}]}],settings:{get:()=> 'spectral'}};
  await discoverPortfolio();assert.match(effectChoices['Compendium.tokenmagic.tmfx-macros.spectralMacro'],/Spectral Body/);
});
