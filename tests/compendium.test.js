import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ensureCompendium} from '../echo-knight/scripts/compendium.js';
test('V11 compendium seeds four legacy items once and preserves edits',async()=>{
  const features=JSON.parse(await readFile(new URL('../echo-knight/data/features.json',import.meta.url),'utf8'));
  let createdPack=0;const items=[];
  const pack={collection:'world.echo-knight-features',locked:false,getIndex:async()=>items,configure:async()=>{}};
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},packs:new Map()};
  globalThis.CompendiumCollection={createCompendium:async()=>{createdPack++;game.packs.set(pack.collection,pack);return pack}};
  globalThis.fetch=async()=>({ok:true,json:async()=>features});
  globalThis.Item={createDocuments:async rows=>items.push(...rows)};
  await ensureCompendium();assert.equal(createdPack,1);assert.equal(items.length,4);
  for(const item of items){assert.equal(item._id.length,16);assert.ok(item.system.activation.cost);assert.equal(item.system.activities,undefined);assert.equal(item.system.actionType,'util')}
  items[0].name='My renamed echo';items[0].system.range.value=25;
  await ensureCompendium();assert.equal(items.length,4);assert.equal(items[0].name,'My renamed echo');assert.equal(items[0].system.range.value,25);
  game.user={id:'player',isGM:false};await ensureCompendium();assert.equal(items.length,4);
});
