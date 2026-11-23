import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {refreshGlow, clearVisuals} from '../echo-knight/scripts/effects.js';
import {flag} from '../echo-knight/scripts/core.js';
let echo, knight, target, state, graphics;
beforeEach(()=>{
  target='echo';state={sourceId:'knight',avatar:{userId:'player',color:'#ff0000'}};graphics=[];
  const make=(id,get)=>({id,visible:true,w:100,h:100,document:{getFlag:get},children:[],addChild(g){this.children.push(g)}});
  echo=make('echo',()=>state);knight=make('knight',()=>undefined);
  globalThis.canvas={ready:true,scene:{tokens:[echo.document]},tokens:{placeables:[echo,knight]}};
  globalThis.game={settings:{get:()=>target},users:new Map([['player',{color:'#123456'}]])};
  globalThis.PIXI={Graphics:class{
    constructor(){graphics.push(this);this.colors=[];this.destroyed=false}
    lineStyle(width,color){this.colors.push(color);return this}
    drawRoundedRect(){return this}
    destroy(){this.destroyed=true}
  }};
});
afterEach(()=>clearVisuals());
test('refreshToken receives a placeable without getFlag: glow reads its document',()=>{
  assert.equal(echo.getFlag,undefined);
  assert.doesNotThrow(()=>refreshGlow(echo));assert.equal(graphics.length,1);
  assert.ok(graphics[0].colors.every(c=>c===0x123456));
  refreshGlow(echo);assert.equal(graphics[0].destroyed,true);assert.equal(graphics.length,2);
  state.avatar=null;refreshGlow(echo);assert.equal(graphics[1].destroyed,true);assert.equal(graphics.length,2);
});
test('knight and both targets resolve the source echo without treating placeables as documents',()=>{
  target='knight';refreshGlow(echo);assert.equal(graphics.length,0);
  refreshGlow(knight);assert.equal(graphics.length,1);
  target='both';refreshGlow(echo);refreshGlow(knight);assert.equal(graphics.length,3);
});
test('ordinary and invisible tokens do not draw a glow',()=>{
  refreshGlow(knight);echo.visible=false;refreshGlow(echo);assert.equal(graphics.length,0);
});
test('flag lookup accepts documents and placeables and safely ignores unrelated objects',()=>{
  assert.equal(flag(echo.document),state);assert.equal(flag(echo),state);
  for(const value of [null,undefined,{}, {getFlag:true}]) assert.equal(flag(value),undefined);
});
