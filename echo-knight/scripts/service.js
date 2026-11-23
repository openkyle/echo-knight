import {echoLightData} from "./lighting.js";
import {syncEchoFilter} from "./tokenmagic.js";
import {ID, flag, actionOf, center, assertOwner, checkPlacement, rangeInScene, SerialQueue} from "./core.js";
import {setting} from "./effects.js";
const queue = new SerialQueue();
let broadcast = async () => {};
export function setBroadcast(fn) { broadcast = fn; }
export const echoesOf = source => source.parent.tokens.filter(t => flag(t)?.sourceId === source.id);
export function manifestRange(item, scene) {
  const activity = item?.system.activities?.find?.(a => Number(a.range?.value) > 0);
  const range = activity?.range ?? item?.system.range;
  return rangeInScene(Number(range?.value) > 0 ? Number(range.value) : setting("manifestRange"), range?.units || "ft", scene.grid.units);
}
async function phase(source, name, tokens) {
  try { await broadcast({sceneId: source.parent.id, phase: name, points: tokens.map(t => center(t)), color: String(game.users.get(flag(tokens[0])?.userId)?.color ?? game.user.color)}); }
  catch (error) { console.warn(`${ID}: effects failed`, error); }
}
export async function removeEcho(echo, reason = "recall") {
  if (!flag(echo) || !echo.parent.tokens.has(echo.id)) return;
  await phase(echo, reason, [echo]);
  await echo.delete();
}
export async function handleRequest(data, user) {
  if (!game.user.isGM) throw new Error("Echo actions must run on a GM client.");
  if (!["manifest", "swap", "recall", "avatar"].includes(data?.action)) throw new Error("Unknown echo action.");
  const scene = game.scenes.get(data.sceneId), source = scene?.tokens.get(data.sourceId);
  assertOwner(user, source);
  return queue.run(source.uuid, async () => {
    if (!scene.tokens.has(source.id)) throw new Error("The knight is no longer on the scene.");
    assertOwner(user, source);
    const echoes = echoesOf(source);
    const echo = data.echoId ? echoes.find(e => e.id === data.echoId) : echoes[0];
    if (data.action === "manifest") {
      const item = source.actor.items.get(data.itemId);
      if (actionOf(item) !== "manifest") throw new Error("Use a Manifest Echo item from this module's compendium.");
      if (!canvas.ready || canvas.scene.id !== scene.id) throw new Error("The GM must view this scene to validate echo placement.");
      const point = {x: data.point?.x, y: data.point?.y};
      checkPlacement(scene, source, point, manifestRange(item, scene), {sight: (a, b) => CONFIG.Canvas.polygonBackends.sight.testCollision(a, b, {type: "sight", mode: "any"})});
      const token = source.toObject();
      delete token._id;
      delete token._stats;
      // A dedicated actor preserves class-based saves without sharing HP or effects.
      token.actorLink = true;
      delete token.delta;
      token.name = `${source.name} — Echo`;
      token.x = point.x; token.y = point.y;
      token.alpha = setting("echoOpacity");
      token.texture = {...token.texture, tint: "#ffffff"};
      if (setting("echoTexture")) token.texture.src = setting("echoTexture");
      token.flags = {[ID]: {echo: {sourceId: source.id, userId: user.id, avatar: null}}};
      token.sight = {...token.sight, enabled: false};
      token.light = echoLightData();
      token.flags[ID].untinted = true;
      token.flags[ID].lightingDefaults = JSON.stringify(token.light);
      token.bar1 = {attribute: "attributes.hp"}; token.bar2 = {attribute: null};
      const delta = source.actor.toObject();
      delete delta._id; delete delta._stats; delete delta.prototypeToken;
      delta.name = token.name;
      delta.effects = [];
      delta.system.attributes.hp = {value: 1, max: 1, temp: 0, tempmax: 0, bonuses: {level: "", overall: ""}};
      delta.system.attributes.ac = {calc: "flat", flat: 14 + Number(source.actor.system.attributes.prof ?? 2)};
      delta.system.traits.ci = {value: Object.keys(CONFIG.DND5E.conditionTypes), custom: ""};
      delta.flags = {[ID]: {generatedEcho: true}};
      delta.folder = null;
      delta.ownership = foundry.utils.deepClone(source.actor.ownership);
      const actor = await Actor.create(delta, {renderSheet: false});
      token.actorId = actor.id;
      let created;
      try { [created] = await scene.createEmbeddedDocuments("Token", [token]); }
      catch (error) { await actor.delete(); throw error; }
      // Creation succeeds before replacing the old echo.
      for (const old of echoes) await removeEcho(old);
      try { await syncEchoFilter(created); }
      catch (error) { console.warn(ID, error); ui.notifications.warn(`Echo created, but TokenMagic could not apply: ${error.message}`); }
      await phase(source, "manifest", [created]);
      return {echoId: created.id};
    }
    if (!echo) throw new Error("Manifest an echo first.");
    if (data.action === "recall") { await removeEcho(echo); return {sourceId: source.id}; }
    if (data.action === "swap") {
      if (!canvas.ready || canvas.scene.id !== scene.id) throw new Error("The GM must view this scene to validate the swap.");
      const a = center(source), b = center(echo), size = scene.grid.size;
      const destination = {x: b.x - source.width * size / 2, y: b.y - source.height * size / 2};
      const other = {x: a.x - echo.width * size / 2, y: a.y - echo.height * size / 2};
      checkPlacement(scene, source, destination, Infinity, {ignore: [source.id, echo.id]});
      checkPlacement(scene, echo, other, Infinity, {ignore: [source.id, echo.id]});
      await phase(source, "swapOut", [source, echo]);
      await scene.updateEmbeddedDocuments("Token", [
        {_id: source.id, ...destination, elevation: echo.elevation},
        {_id: echo.id, ...other, elevation: source.elevation}
      ], {animate: false, teleport: true});
      await phase(source, "swapIn", [source, echo]);
      return {sourceId: source.id};
    }
    const item = source.actor.items.get(data.itemId) ?? source.actor.items.find(i => actionOf(i) === "avatar");
    if (actionOf(item) !== "avatar") throw new Error("Add Echo Avatar from the compendium first.");
    const active = !!flag(echo).avatar;
    await echo.update({[`flags.${ID}.echo.avatar`]: active ? null : {userId: user.id, color: String(user.color)}, "sight.enabled": active ? false : source.sight.enabled});
    await phase(source, active ? "avatarOff" : "avatarOn", [echo]);
    return {focusId: active ? source.id : echo.id};
  });
}
