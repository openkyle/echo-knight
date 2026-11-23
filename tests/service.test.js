import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest, removeEcho, setBroadcast} from '../echo-knight/scripts/service.js';
const clone = value => structuredClone(value);
class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
  some(fn){return [...this.values()].some(fn)}
  find(fn){return [...this.values()].find(fn)}
  filter(fn){return [...this.values()].filter(fn)}
}
let source, scene, owner, actors, created, phases;
function doc(data) {
  return {...data, getFlag(scope,key){return this.flags?.[scope]?.[key]}, async update(changes){
    for(const [key,value] of Object.entries(changes)) {const path=key.split('.');let o=this;for(const p of path.slice(0,-1))o=o[p]??={};o[path.at(-1)]=value;}
    return this;
  }, async delete(){scene.tokens.delete(this.id)}, toObject(){return clone({name:this.name,actorId:this.actorId,x:this.x,y:this.y,width:this.width,height:this.height,elevation:this.elevation,texture:this.texture,sight:this.sight,light:{},flags:this.flags})}};
}
beforeEach(()=>{
  owner={id:'owner',active:true,color:'#ff4400'};created=[];phases=[];actors=new Collection();
  const items=new Collection();
  for(const action of ['manifest','avatar'])items.set(action,{id:action,system:{range:{value:15,units:'ft'}},getFlag:()=>action});
  const actor={id:'actor',items,ownership:{owner:3},system:{attributes:{prof:3,hp:{value:24,max:24}}},testUserPermission:u=>u.id==='owner',toObject:()=>({name:'Knight',type:'character',items:[],system:{attributes:{hp:{value:24,max:24}},traits:{ci:{}}},effects:[]})};
  source=doc({id:'source',uuid:'Scene.s.Token.source',name:'Knight',actorId:'actor',actor,x:100,y:100,width:1,height:1,elevation:0,texture:{src:'knight.png'},sight:{enabled:true},flags:{}});
  scene={id:'s',grid:{size:100,distance:5,units:'ft'},dimensions:{sceneRect:{x:0,y:0,width:2000,height:2000}},tokens:new Collection(),async createEmbeddedDocuments(type,rows){return rows.map(row=>{created.push(row);const id=`echo${created.length}`;const d=doc({...row,id,uuid:`Scene.s.Token.${id}`,parent:scene,actor:actors.get(row.actorId)});scene.tokens.set(id,d);return d})},async updateEmbeddedDocuments(type,rows){for(const row of rows)await scene.tokens.get(row._id).update(row)}};
  source.parent=scene;scene.tokens.set(source.id,source);
  const scenes=new Collection([['s',scene]]),users=new Collection([['owner',owner]]);
  globalThis.game={user:{id:'gm',isGM:true,color:'#ffffff'},users,scenes,actors,settings:{get:(id,key)=>({manifestRange:15,echoOpacity:0.5,echoTexture:''})[key]}};
  globalThis.Ray=class{constructor(a,b){this.A=a;this.B=b}};
  globalThis.canvas={ready:true,scene,grid:{measureDistances:rays=>rays.map(({ray})=>Math.hypot(ray.A.x-ray.B.x,ray.A.y-ray.B.y)/20)}};
  globalThis.CONFIG={Canvas:{polygonBackends:{sight:{testCollision:()=>false}}},DND5E:{conditionTypes:{poisoned:'Poisoned',stunned:'Stunned'}}};
  globalThis.foundry={utils:{deepClone:clone}};
  globalThis.Actor={create:async data=>{const a={...data,id:`a${actors.size}`,getFlag:(s,k)=>data.flags?.[s]?.[k],delete:async()=>actors.delete(a.id)};actors.set(a.id,a);return a}};
  setBroadcast(async p=>phases.push(p.phase));
});
const request=action=>({action,sceneId:'s',sourceId:'source',itemId:action,point:{x:300,y:100}});
test('manifest creates independent 1 HP actor with ownership, token art and derived AC',async()=>{
  const result=await handleRequest(request('manifest'),owner);const echo=scene.tokens.get(result.echoId);
  assert.equal(echo.actor.system.attributes.hp.value,1);assert.equal(echo.actor.system.attributes.hp.max,1);
  assert.equal(echo.actor.system.attributes.ac.flat,17);assert.equal(source.actor.system.attributes.hp.value,24);
  assert.deepEqual(echo.actor.ownership,{default:3,owner:3});assert.equal(echo.texture.src,'knight.png');assert.equal(echo.actorLink,true);
  assert.deepEqual(phases,['manifest']);
});
test('rejects non-owner, invalid item, invalid action and out of range',async()=>{
  await assert.rejects(handleRequest(request('manifest'),{id:'stranger',active:true}),/own/);
  await assert.rejects(handleRequest({...request('manifest'),itemId:'wrong'},owner),/compendium/);
  await assert.rejects(handleRequest(request('deleteActor'),owner),/Unknown/);
  await assert.rejects(handleRequest({...request('manifest'),point:{x:1000,y:100}},owner),/range/);
  assert.equal(created.length,0);
});
test('swap moves both tokens without moving either actor HP',async()=>{
  const {echoId}=await handleRequest(request('manifest'),owner);
  await handleRequest({...request('swap'),echoId},owner);
  assert.equal(source.x,300);assert.equal(scene.tokens.get(echoId).x,100);
  assert.equal(source.actor.system.attributes.hp.value,24);
  assert.deepEqual(phases,['manifest','swapOut','swapIn']);
});
test('avatar toggles player color while shared vision stays enabled; recall never removes source',async()=>{
  const {echoId}=await handleRequest(request('manifest'),owner);const echo=scene.tokens.get(echoId);
  assert.equal((await handleRequest(request('avatar'),owner)).focusId,echoId);
  assert.equal(echo.getFlag('echo-knight','echo').avatar.color,'#ff4400');assert.equal(echo.sight.enabled,true);
  assert.equal((await handleRequest(request('avatar'),owner)).focusId,'source');assert.equal(echo.sight.enabled,true);
  await handleRequest(request('recall'),owner);assert.equal(scene.tokens.size,1);assert.ok(scene.tokens.has('source'));
});
test('re-manifest replaces old echo and refusing to remove source is safe',async()=>{
  await handleRequest(request('manifest'),owner);
  await handleRequest({...request('manifest'),point:{x:400,y:100}},owner);
  assert.equal(scene.tokens.size,2);
  await removeEcho(source);assert.ok(scene.tokens.has('source'));
});
test('failed creation rolls back temporary actor and preserves existing echo',async()=>{
  const {echoId}=await handleRequest(request('manifest'),owner);
  const count=actors.size;scene.createEmbeddedDocuments=async()=>{throw Error('creation failed')};
  await assert.rejects(handleRequest({...request('manifest'),point:{x:400,y:100}},owner),/creation failed/);
  assert.equal(actors.size,count);assert.ok(scene.tokens.has(echoId));
});
