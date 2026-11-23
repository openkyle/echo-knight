import {ID, flag, SerialQueue} from "./core.js";
export const SPECTRAL = [{filterType: "liquid", filterId: "mySpectralBody", color: 0x20AAEE, time: 0, blend: 8, intensity: 4, spectral: true, scale: 0.9, animated: {time: {active: true, speed: 0.0010, animType: "move"}, color: {active: true, loopDuration: 6000, animType: "colorOscillation", val1: 0xFFFFFF, val2: 0x00AAFF}}}];
export const effectChoices = {spectral: "26 – T01 – Spectral Body (liquid) — supplied preset"};
const queue = new SerialQueue();
// Read portfolio parameter literals without executing selection macros or arbitrary code.
export function parsePortfolio(command) {
  const match = /\b(?:let|const|var)\s+params\s*=\s*/.exec(command);
  if (!match) throw new Error("This portfolio macro has no literal params array.");
  const text = command.slice(match.index + match[0].length);
  let pos = 0;
  function space() {
    for (;;) {
      const m = /^(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)/.exec(text.slice(pos));
      if (!m) break; pos += m[0].length;
    }
  }
  function value(depth = 0) {
    if (depth > 30) throw new Error("Portfolio parameters are too deeply nested.");
    space(); const ch = text[pos];
    if (ch === '[' || ch === '{') {
      const array = ch === '[', result = array ? [] : {}, end = array ? ']' : '}'; pos++;
      space();
      while (text[pos] !== end) {
        let key;
        if (!array) {
          space();
          if (["'", '"'].includes(text[pos])) key = value(depth + 1);
          else {const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(pos)); if (!m) throw Error('Invalid parameter key'); key = m[0]; pos += key.length;}
          if (['__proto__','prototype','constructor'].includes(key)) throw Error('Invalid parameter key');
          space(); if (text[pos++] !== ':') throw Error('Expected parameter value');
        }
        const item = value(depth + 1);
        if (array) result.push(item); else result[key] = item;
        space(); if (text[pos] === end) break;
        if (text[pos++] !== ',') throw Error('Only literal portfolio parameters are supported');
        space();
      }
      pos++; return result;
    }
    if (ch === '"' || ch === "'") {
      const quote = text[pos++]; let result = '';
      while (pos < text.length) {
        const c = text[pos++]; if (c === quote) return result;
        if (c === '\\') {const escaped = text[pos++]; const escapes = {n:'\n',r:'\r',t:'\t'}; result += escapes[escaped] ?? escaped;} else result += c;
      }
      throw Error('Unterminated parameter string');
    }
    const m = /^(?:-?(?:0x[\da-f]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|true\b|false\b|null\b)/i.exec(text.slice(pos));
    if (!m) throw Error('Only literal portfolio parameters are supported');
    pos += m[0].length;
    if (m[0] === 'true') return true; if (m[0] === 'false') return false; if (m[0] === 'null') return null;
    const number = Number(m[0]); if (!Number.isFinite(number)) throw Error('Invalid parameter number'); return number;
  }
  const params = value();
  space(); if (text[pos] && text[pos] !== ';') throw Error('Expected a complete literal params assignment');
  if (!Array.isArray(params) || !params.length || params.some(p => !p || typeof p.filterType !== 'string')) throw Error('No TokenMagic filters found');
  return params;
}
export async function discoverPortfolio() {
  for (const pack of game.packs) {
    if (pack.documentName !== 'Macro' || !/token.?magic|tmfx/i.test(`${pack.collection} ${pack.metadata?.label}`)) continue;
    try {
      const index = await pack.getIndex();
      for (const entry of index) effectChoices[`Compendium.${pack.collection}.${entry._id}`] = `${entry.name} — ${pack.metadata.label}`;
    } catch (error) { console.warn(`${ID}: unable to read TokenMagic portfolio`, error); }
  }
  const selected = game.settings.get(ID, 'tokenMagicEffect');
  if (selected && !effectChoices[selected]) effectChoices[selected] = `${selected} (currently unavailable)`;
}
export async function syncEchoFilter(doc) {
  if (!flag(doc) || game.users.activeGM?.id !== game.user.id) return;
  return queue.run(doc.uuid, async () => {
    const tm = globalThis.TokenMagic;
    if (!game.modules.get('tokenmagic')?.active || !tm?.addUpdateFilters || !doc.object) return;
    const enabled = game.settings.get(ID, 'tokenMagicEnabled');
    const selected = game.settings.get(ID, 'tokenMagicEffect');
    const previous = doc.getFlag(ID, 'tokenMagic');
    if (!enabled && !previous) return;
    if (enabled && previous?.effect === selected) return;
    let params;
    if (enabled) {
      if (selected === 'spectral') params = structuredClone(SPECTRAL);
      else {
        const macro = await fromUuid(selected);
        if (macro?.documentName !== 'Macro' || !macro.pack || !/token.?magic|tmfx/i.test(`${macro.pack} ${game.packs.get(macro.pack)?.metadata?.label}`)) throw Error('Choose a TokenMagic portfolio macro.');
        params = parsePortfolio(macro.command);
      }
      params = params.map((p, i) => ({...p, filterId: `${ID}-body-${i}`}));
    }
    for (const id of previous?.ids ?? []) await tm.deleteFilters(doc.object, id);
    if (enabled) {
      await tm.addUpdateFilters(doc.object, params);
      await doc.setFlag(ID, 'tokenMagic', {effect: selected, ids: params.map(p => p.filterId)});
    } else await doc.unsetFlag(ID, 'tokenMagic');
  });
}
export async function syncSceneFilters() {
  if (!globalThis.canvas?.ready) return;
  for (const token of canvas.tokens.placeables) {
    try { await syncEchoFilter(token.document); }
    catch (error) { console.warn(ID, error); ui.notifications.warn(`Echo TokenMagic: ${error.message}`); }
  }
}
export function registerTokenMagicSettings() {
  const change = () => { void syncSceneFilters(); };
  game.settings.register(ID, 'tokenMagicEnabled', {name: 'Enable TokenMagic effect on echoes', hint: 'Requires Token Magic FX. Applies to the echo, never the currently selected knight.', scope:'world', config:true, type:Boolean, default:false, onChange:change});
  game.settings.register(ID, 'tokenMagicEffect', {name:'Echo TokenMagic portfolio effect', hint:'Spectral Body uses the supplied parameters. Portfolio choices support macros with a literal params array; scripted/randomized expressions are not executed.', scope:'world', config:true, type:String, default:'spectral', choices:effectChoices, onChange:change});
}
