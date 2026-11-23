import {test} from 'node:test';
import assert from 'node:assert/strict';
const hooks=new Map();
globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn),once:()=>{}};
await import('../echo-knight/scripts/main.js');
test('zero HP hook deletes only echo token and cleans its generated actor',async()=>{
  const tokens=new Map();tokens.filter=fn=>[...tokens.values()].filter(fn);tokens.some=fn=>[...tokens.values()].some(fn);
  const actors=new Map();let actorDeleted=false;
  const actor={id:'echoActor',system:{attributes:{hp:{value:0}}},getFlag:(id,key)=>key==='generatedEcho',delete:async()=>{actorDeleted=true;actors.delete('echoActor')}};actors.set(actor.id,actor);
  const scene={id:'s',grid:{size:100},tokens};
  const original={id:'source',actorId:'realActor'};tokens.set('source',original);
  const token={id:'echo',uuid:'echoUUID',actorId:'echoActor',actor,parent:scene,x:200,y:100,width:1,height:1,getFlag:()=>({sourceId:'source'}),delete:async()=>{tokens.delete('echo');hooks.get('deleteToken')(token)}};tokens.set('echo',token);
  const scenes=[scene];
  globalThis.game={user:{id:'gm',color:'#ffffff'},users:{activeGM:{id:'gm'},get:()=>({color:'#ff0000'})},scenes,actors};
  globalThis.canvas={ready:false};globalThis.ui={notifications:{error:message=>{throw Error(message)}}};
  hooks.get('updateActor')(actor);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(tokens.has('source'));assert.equal(tokens.has('echo'),false);assert.equal(actorDeleted,true);
});
