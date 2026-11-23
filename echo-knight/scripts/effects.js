import {ID, flag} from "./core.js";
export const phases = {manifest: "Manifest", swapOut: "Swap departure", swapIn: "Swap arrival", avatarOn: "Avatar enter", avatarOff: "Avatar return", recall: "Recall", destroy: "Destroyed at 0 HP"};
export const setting = key => game.settings.get(ID, key);
export function registerSettings() {
  const add = (key, name, type, value, extra = {}) => game.settings.register(ID, key, {name, scope: "world", config: true, type, default: value, ...extra});
  add("manifestRange", "Default manifest range (feet)", Number, 15);
  add("echoOpacity", "Echo opacity", Number, 0.5, {range: {min: 0.1, max: 1, step: 0.05}});
  add("echoTexture", "Echo image/video override", String, "", {filePicker: "imagevideo", hint: "Blank copies the knight's token art. Animated WebM token art is supported."});
  add("glowTarget", "Echo Avatar glow target", String, "echo", {choices: {echo: "Echo (occupied body)", knight: "Original knight", both: "Both"}});
  add("builtinEffects", "Enable built-in animated phase effects", Boolean, true);
  add("volume", "Phase sound volume", Number, 0.5, {range: {min: 0, max: 1, step: 0.05}});
  for (const [phase, label] of Object.entries(phases)) {
    add(`${phase}Effect`, `${label}: animation`, String, "", {filePicker: "imagevideo", hint: "Optional animation file or Sequencer database key; requires Sequencer. Blank uses the built-in pulse."});
    add(`${phase}Sound`, `${label}: sound`, String, "", {filePicker: "audio", hint: "Optional audio file; played once for users viewing this scene."});
  }
}
const live = new Set();
function pulse(point, color) {
  const graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  canvas.interface.addChild(graphics);
  const started = performance.now(), ticker = canvas.app.ticker;
  const cleanup = () => { ticker.remove(tick); if (!graphics.destroyed) graphics.destroy(); live.delete(cleanup); };
  const tick = () => {
    if (!canvas.ready || graphics.destroyed) return cleanup();
    const t = (performance.now() - started) / 650;
    if (t >= 1) return cleanup();
    graphics.clear().lineStyle(5, color, 1 - t).drawCircle(point.x, point.y, canvas.grid.size * (0.2 + t * 0.8));
  };
  live.add(cleanup); ticker.add(tick);
}
export async function playPhase({sceneId, phase, points, color = "#70dcff"}) {
  if (!canvas.ready || canvas.scene.id !== sceneId || !phases[phase]) return;
  try {
    const sound = setting(`${phase}Sound`);
    if (sound) {
      const audio = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
      await audio.play({src: sound, volume: setting("volume"), autoplay: true, loop: false}, false);
    }
  } catch (error) { console.warn(`${ID}: sound failed`, error); }
  const file = setting(`${phase}Effect`);
  for (const point of points) {
    try {
      if (file && game.modules.get("sequencer")?.active && globalThis.Sequence) {
        // Each viewing client receives this event once; do not broadcast it again.
        await new Sequence().effect().file(file).atLocation(point).size(canvas.grid.size * 2).play({local: true});
      } else if (setting("builtinEffects")) pulse(point, Number.parseInt(String(color).replace("#", ""), 16) || 0x70dcff);
    } catch (error) { console.warn(`${ID}: animation failed`, error); }
  }
}
const glows = new Map();
export function clearVisuals() {
  for (const stop of [...live]) stop();
  for (const g of glows.values()) if (!g.destroyed) g.destroy();
  glows.clear();
}
export function refreshGlow(token) {
  const old = glows.get(token.id);
  if (old && !old.destroyed) old.destroy();
  glows.delete(token.id);
  if (!canvas.ready || !token.visible) return;
  let avatar = flag(token)?.avatar;
  const target = setting("glowTarget");
  if (flag(token) && target === "knight") return;
  if (!flag(token)) {
    if (target === "echo") return;
    avatar = canvas.scene.tokens.find(t => flag(t)?.sourceId === token.id && flag(t)?.avatar)?.getFlag(ID, "echo")?.avatar;
  }
  if (!avatar) return;
  const color = Number.parseInt(String(game.users.get(avatar.userId)?.color ?? avatar.color).replace("#", ""), 16) || 0x70dcff;
  const g = new PIXI.Graphics();
  g.eventMode = "none";
  for (let width = 24; width >= 4; width -= 4) g.lineStyle(width, color, width === 4 ? 0.9 : 0.08).drawRoundedRect(2, 2, token.w - 4, token.h - 4, 12);
  token.addChild(g); glows.set(token.id, g);
}
export function refreshGlows() { for (const token of canvas.tokens?.placeables ?? []) refreshGlow(token); }
