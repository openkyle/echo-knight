import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPlacement, rangeInScene, assertOwner, SerialQueue} from '../echo-knight/scripts/core.js';
const makeScene = () => ({id:'s', grid: {size:100, distance:5, units:'ft', measurePath: ([a,b]) => ({distance:Math.hypot(a.x-b.x,a.y-b.y)/20})}, dimensions:{sceneRect:{x:0,y:0,width:1000,height:1000}}, tokens:[]});
const source = {id:'knight', x:100,y:100,width:1,height:1,elevation:0};
test('accepts exact range, rejects out of range and invalid coordinates', () => {
  const scene=makeScene();
  assert.deepEqual(checkPlacement(scene,source,{x:400,y:100},15),{x:450,y:150});
  assert.throws(()=>checkPlacement(scene,source,{x:401,y:100},15),/range/);
  assert.throws(()=>checkPlacement(scene,source,{x:NaN,y:100},15),/Invalid/);
});
test('rejects occupancy, blocked sight and outside scene',()=>{
  const scene=makeScene();scene.tokens=[{...source,id:'enemy',x:200}];
  assert.throws(()=>checkPlacement(scene,source,{x:200,y:100},15),/occupied/);
  assert.doesNotThrow(()=>checkPlacement(scene,source,{x:200,y:100},15,{ignore:['enemy']}));
  assert.throws(()=>checkPlacement(scene,source,{x:300,y:100},15,{sight:()=>true}),/see/);
  assert.throws(()=>checkPlacement(scene,source,{x:950,y:100},Infinity),/inside/);
});
test('touching edges do not count as occupied',()=>{
  const scene=makeScene();scene.tokens=[source];
  assert.doesNotThrow(()=>checkPlacement(scene,source,{x:200,y:100},15));
});
test('documents with inherited getters retain dimensions',()=>{
  class Token {get x(){return 100} get y(){return 100} get width(){return 2} get height(){return 2}}
  assert.deepEqual(checkPlacement(makeScene(),new Token(),{x:300,y:100},15),{x:400,y:200});
});
test('converts tabletop feet/metres and rejects unknown units',()=>{
  assert.equal(rangeInScene(15,'ft','m'),4.5);
  assert.equal(rangeInScene(4.5,'m','ft'),15);
  assert.throws(()=>rangeInScene(15,'ft','hexes'),/Unsupported/);
});
test('ownership requires active owner and disallows echo as source',()=>{
  const token={actor:{testUserPermission:u=>u.id==='owner'},getFlag:()=>undefined};
  assert.doesNotThrow(()=>assertOwner({active:true,id:'owner'},token));
  assert.throws(()=>assertOwner({active:true,id:'stranger'},token),/own/);
  assert.throws(()=>assertOwner({active:false,id:'owner'},token),/own/);
  assert.throws(()=>assertOwner({active:true,isGM:true},{...token,getFlag:()=>({sourceId:'a'})}),/original/);
});
test('serializes same knight actions and recovers after failures',async()=>{
  const queue=new SerialQueue(),events=[];
  let release;const gate=new Promise(r=>release=r);
  const first=queue.run('a',async()=>{events.push(1);await gate;events.push(2);throw Error('failed')});
  const failure=assert.rejects(first,/failed/);
  const second=queue.run('a',async()=>events.push(3));
  await queue.run('b',async()=>events.push('independent'));
  assert.deepEqual(events,[1,'independent']);release();await failure;await second;
  assert.deepEqual(events,[1,'independent',2,3]);
});
