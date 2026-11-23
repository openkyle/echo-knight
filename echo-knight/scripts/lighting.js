import {ID, flag} from './core.js';
const defaults = {lightDim:0, lightBright:0, lightAngle:360, lightColor:'', lightAlpha:0.5, lightAnimation:'', lightSpeed:5, lightIntensity:5, lightReverse:false};
let pending;
export function lightAnimationChoices() {
  return {'': 'None', ...Object.fromEntries(Object.entries(CONFIG.Canvas.lightAnimations ?? {}).map(([key, value]) => [key, game.i18n.localize(value.label ?? key)]))};
}
export function echoLightData() {
  const get = key => game.settings.get(ID, key) ?? defaults[key];
  const number = (key, min, max) => { const n = Number(get(key)); return Math.min(max, Math.max(min, Number.isFinite(n) ? n : defaults[key])); };
  const color = String(get('lightColor')).trim();
  const type = String(get('lightAnimation'));
  return {
    dim: number('lightDim',0,Infinity), bright:number('lightBright',0,Infinity), angle:number('lightAngle',0,360),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : null, alpha:number('lightAlpha',0,1),
    animation:{type:type && CONFIG.Canvas.lightAnimations?.[type] ? type : null, speed:number('lightSpeed',1,10), intensity:number('lightIntensity',1,10), reverse:!!get('lightReverse')}
  };
}
export function registerLightingSettings() {
  const onChange = () => {
    clearTimeout(pending);
    pending = setTimeout(() => { void syncEchoLighting(true).catch(error => ui.notifications.error(`Echo lighting: ${error.message}`)); }, 100);
  };
  const add = (key,name,type,extra={}) => game.settings.register(ID,key,{name,scope:'world',config:true,type,default:defaults[key],onChange,...extra});
  add('lightDim','Echo light: dim radius',Number,{hint:'Scene distance units (feet on a feet-based scene). Set both radii to 0 for no light.'});
  add('lightBright','Echo light: bright radius',Number,{hint:'Bright light radius, included within the dim radius.'});
  add('lightAngle','Echo light: emission angle (degrees)',Number,{range:{min:0,max:360,step:1}});
  add('lightColor','Echo light: color',String,{hint:'Choose a light color, or leave blank for uncolored light. This does not tint the token image.'});
  add('lightAlpha','Echo light: color intensity',Number,{range:{min:0,max:1,step:0.05}});
  add('lightAnimation','Echo light: animation',String,{choices:lightAnimationChoices()});
  add('lightSpeed','Echo light: animation speed',Number,{range:{min:1,max:10,step:1}});
  add('lightIntensity','Echo light: animation intensity',Number,{range:{min:1,max:10,step:1}});
  add('lightReverse','Echo light: reverse animation',Boolean);
}
// Only apply defaults when changed. Individual Token Configuration edits survive reloads.
export async function syncEchoLighting(force=false) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const light = echoLightData(), signature = JSON.stringify(light);
  for (const scene of game.scenes) {
    const updates=[];
    for (const token of scene.tokens) {
      if (!flag(token)) continue;
      const update={_id:token.id};
      if (!token.getFlag(ID,'untinted')) {
        if (String(token.texture?.tint).toLowerCase() === '#b8c4d8') update['texture.tint']='#ffffff';
        update[`flags.${ID}.untinted`]=true;
      }
      if (force || token.getFlag(ID,'lightingDefaults') !== signature) {
        for (const [key,value] of Object.entries(light)) update[`light.${key}`]=value;
        update[`flags.${ID}.lightingDefaults`]=signature;
      }
      if (Object.keys(update).length>1) updates.push(update);
    }
    if (updates.length) await scene.updateEmbeddedDocuments('Token',updates);
  }
}
export function enhanceLightSettings(html) {
  const root=html[0] ?? html;
  const input=root.querySelector('input[name="echo-knight.lightColor"]');
  if (input && !input.parentElement.querySelector('.echo-light-color')) {
    const picker=document.createElement('input');picker.type='color';picker.className='echo-light-color';picker.setAttribute('aria-label','Echo light color');
    picker.value=/^#[0-9a-f]{6}$/i.test(input.value)?input.value:'#ffffff';
    picker.addEventListener('input',()=>{input.value=picker.value;input.dispatchEvent(new Event('change',{bubbles:true}));});
    input.addEventListener('input',()=>{if (/^#[0-9a-f]{6}$/i.test(input.value)) picker.value=input.value;});
    input.after(picker);
  }
  const select=root.querySelector('select[name="echo-knight.lightAnimation"]');
  if (select) {const current=select.value;select.replaceChildren(...Object.entries(lightAnimationChoices()).map(([value,label])=>new Option(label,value,false,value===current)));}
}
