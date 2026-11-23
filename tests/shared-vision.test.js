import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sharedOwnership,isSharedEchoVision,installSharedVision} from '../echo-knight/scripts/shared-vision.js';
test('all players including future users own generated echoes; source ownership is untouched',()=>{
  const source={default:0,alice:3,bob:0};
  assert.deepEqual(sharedOwnership(source),{default:3,alice:3,bob:3});
  assert.deepEqual(source,{default:0,alice:3,bob:0});
});
test('shares echo vision while another token is controlled but respects hidden and disabled sight',()=>{
  globalThis.game={user:{isGM:false}};globalThis.canvas={scene:{tokenVision:true},tokens:{controlled:[{id:'another'}]}};
  const token={isOwner:true,actor:{getFlag:()=>true},document:{getFlag:()=>({sourceId:'knight'}),sight:{enabled:true},hidden:false}};
  assert.equal(isSharedEchoVision(token),true);
  token.document.hidden=true;assert.equal(isSharedEchoVision(token),false);token.document.hidden=false;
  token.document.sight.enabled=false;assert.equal(isSharedEchoVision(token),false);token.document.sight.enabled=true;
  game.user.isGM=true;assert.equal(isSharedEchoVision(token),false);
});
test('wrapper preserves normal token behavior and includes the shared echo',()=>{
  globalThis.game={user:{isGM:false}};globalThis.canvas={scene:{tokenVision:true}};
  class Token{_isVisionSource(){return false}}
  globalThis.CONFIG={Token:{objectClass:Token}};installSharedVision();
  const echo=new Token();Object.assign(echo,{isOwner:true,actor:{getFlag:()=>true},document:{getFlag:()=>({sourceId:'knight'}),sight:{enabled:true},hidden:false}});
  assert.equal(echo._isVisionSource(),true);
  const ordinary=new Token();ordinary.document={getFlag:()=>undefined};assert.equal(ordinary._isVisionSource(),false);
});
