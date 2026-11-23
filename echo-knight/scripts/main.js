import {syncEchoLighting, enhanceLightSettings} from "./lighting.js";
import {discoverPortfolio, effectChoices, syncSceneFilters, syncEchoFilter} from "./tokenmagic.js";
import {ID, flag, actionOf} from "./core.js";
import {registerSettings, playPhase, refreshGlow, refreshGlows, clearVisuals} from "./effects.js";
import {handleRequest, echoesOf, manifestRange, removeEcho, setBroadcast} from "./service.js";
import {pickPosition, cancelPlacement} from "./placement.js";
import {ensureCompendium} from "./compendium.js";
let socket;
const busy = new Set();
const report = error => { console.error(ID, error); ui.notifications.error(error.message ?? String(error)); };
function registerSocket() {
  if (socket || !globalThis.socketlib) return;
  socket = socketlib.registerModule(ID);
  socket.register("action", async function(data) {
    try { return {ok: true, result: await handleRequest(data, game.users.get(this.socketdata.userId))}; }
    catch (error) { return {ok: false, error: error.message}; }
  });
  socket.register("phase", function(data) {
    if (!game.users.get(this.socketdata.userId)?.isGM) return;
    return playPhase(data);
  });
  setBroadcast(data => socket.executeForEveryone("phase", data));
}
Hooks.once("socketlib.ready", registerSocket);
Hooks.once("init", registerSettings);
Hooks.once("ready", async () => {
  registerSocket();
  await discoverPortfolio();
  await syncEchoLighting();
  game.modules.get(ID).api = {useItem, repairCompendium: ensureCompendium};
  if (!socket) ui.notifications.error("Echo Knight requires Socketlib. Enable it and reload the world.");
  try { await ensureCompendium(); } catch (error) { report(error); }
  if (game.users.activeGM?.id === game.user.id) await reconcile();
});
async function request(data) {
  if (!socket) throw new Error("Enable Socketlib and reload the world.");
  if (!game.users.activeGM) throw new Error("A GM must be online to manage echoes.");
  const response = await socket.executeAsUser("action", game.users.activeGM.id, data);
  if (!response.ok) throw new Error(response.error);
  return response.result;
}
function sourceFor(item) {
  if (!canvas.ready) throw new Error("Open a scene with your knight's token.");
  const controlled = canvas.tokens.controlled.filter(t => t.actor?.id === item.actor?.id && !flag(t.document));
  if (controlled.length === 1) return controlled[0].document;
  const candidates = canvas.tokens.placeables.filter(t => t.actor?.id === item.actor?.id && !flag(t.document));
  if (candidates.length !== 1) throw new Error("Select exactly one token belonging to this knight.");
  return candidates[0].document;
}
async function focus(id) {
  if (!id) return;
  const token = canvas.tokens.get(id);
  if (token?.isOwner) { token.control({releaseOthers: true}); await canvas.animatePan(token.center); }
}
export async function useItem(item) {
  if (!item?.actor || !actionOf(item)) return;
  const source = sourceFor(item);
  if (busy.has(source.uuid)) return;
  busy.add(source.uuid);
  const sheet = item.actor.sheet;
  let minimized = false;
  try {
    const action = actionOf(item);
    let point;
    if (action === "manifest") {
      if (sheet.rendered && !sheet.minimized && !sheet._minimized) { await sheet.minimize(); minimized = true; }
      point = await pickPosition(source.object, manifestRange(item, source.parent));
      if (!point) return;
    }
    const result = await request({action, sceneId: source.parent.id, sourceId: source.id, itemId: item.id, point});
    await focus(result?.focusId ?? result?.sourceId);
  } finally { busy.delete(source.uuid); if (minimized) await sheet.maximize(); }
}
// Synchronous cancellation prevents normal use from triggering an extra effect or card.
Hooks.on("dnd5e.preUseItem", item => {
  if (!actionOf(item)) return;
  void useItem(item).catch(report);
  return false;
});
Hooks.on("renderTokenHUD", (hud, html) => {
  const token = hud.object?.document;
  if (!token) return;
  const source = flag(token) ? token.parent.tokens.get(flag(token).sourceId) : token;
  if (!source?.actor?.testUserPermission(game.user, "OWNER")) return;
  const echo = flag(token) ? token : echoesOf(source)[0];
  if (!echo) return;
  const root = html instanceof HTMLElement ? html : html?.[0] ?? hud.element;
  if (!root?.querySelector || root.querySelector(".echo-knight-controls")) return;
  const row = document.createElement("div"); row.className = "echo-knight-controls";
  const controls = [["swap", "fa-right-left", "Swap with echo (15 feet of movement)"], ["recall", "fa-xmark", "Recall echo"]];
  if (source.actor.items.some(i => actionOf(i) === "avatar")) controls.push(["avatar", "fa-eye", "Toggle Echo Avatar"]);
  for (const [action, icon, title] of controls) {
    const button = document.createElement("button");
    button.type = "button"; button.title = title; button.setAttribute("aria-label", title);
    const glyph = document.createElement("i"); glyph.className = `fas ${icon}`; button.append(glyph);
    button.addEventListener("click", async event => {
      event.preventDefault(); event.stopPropagation();
      if (busy.has(source.uuid)) return;
      busy.add(source.uuid);
      row.querySelectorAll("button").forEach(b => b.disabled = true);
      try {
        const result = await request({action, sceneId: source.parent.id, sourceId: source.id, echoId: echo.id});
        await focus(result?.focusId ?? result?.sourceId);
        hud.clear();
      } catch (error) { report(error); }
      finally { busy.delete(source.uuid); row.querySelectorAll("button").forEach(b => b.disabled = false); }
    });
    row.append(button);
  }
  (root.querySelector(".col.right") ?? root).append(row);
});
const deleting = new Set();
async function destroyEcho(token) {
  if (deleting.has(token.uuid)) return;
  deleting.add(token.uuid);
  try { await removeEcho(token, "destroy"); } finally { deleting.delete(token.uuid); }
}
async function reconcile() {
  for (const scene of game.scenes) for (const token of [...scene.tokens]) {
    if (!flag(token)) continue;
    if (!scene.tokens.has(flag(token).sourceId) || Number(token.actor?.system.attributes.hp.value) <= 0) await destroyEcho(token);
  }
  for (const actor of game.actors.filter(a => a.getFlag(ID, "generatedEcho"))) {
    if (!game.scenes.some(s => s.tokens.some(t => t.actorId === actor.id))) await actor.delete();
  }
}
Hooks.on("updateActor", actor => {
  if (game.users.activeGM?.id !== game.user.id || !actor.getFlag(ID, "generatedEcho") || Number(actor.system.attributes.hp.value) > 0) return;
  for (const scene of game.scenes) for (const token of scene.tokens.filter(t => t.actorId === actor.id && flag(t))) void destroyEcho(token).catch(report);
});
Hooks.on("deleteToken", token => {
  refreshGlows();
  if (game.users.activeGM?.id !== game.user.id) return;
  void (async () => {
    if (!flag(token)) for (const echo of echoesOf(token)) await removeEcho(echo);
    const actor = game.actors.get(token.actorId);
    if (actor?.getFlag(ID, "generatedEcho") && !game.scenes.some(s => s.tokens.some(t => t.actorId === actor.id))) await actor.delete();
  })().catch(report);
});
Hooks.on("updateUser", () => { refreshGlows(); if (game.users.activeGM?.id === game.user.id) void reconcile().catch(report); });
Hooks.on("canvasReady", () => { refreshGlows(); if (game.users.activeGM?.id === game.user.id) void reconcile().catch(report); });
Hooks.on("updateToken", refreshGlows);
Hooks.on("refreshToken", refreshGlow);
Hooks.on("canvasTearDown", () => { cancelPlacement(); clearVisuals(); });

Hooks.on("drawToken", token => { void syncEchoFilter(token.document).catch(error => console.warn(ID, error)); });
Hooks.on("canvasReady", () => { void syncSceneFilters(); });
Hooks.on("renderSettingsConfig", async (app, html) => {
  await discoverPortfolio();
  const root = html[0] ?? html;
  const select = root.querySelector('select[name="echo-knight.tokenMagicEffect"]');
  if (!select) return;
  const current = select.value || game.settings.get(ID, 'tokenMagicEffect');
  select.replaceChildren(...Object.entries(effectChoices).map(([value, label]) => new Option(label, value, false, value === current)));
});

Hooks.on("canvasReady", () => { void syncEchoLighting().catch(report); });
Hooks.on("renderSettingsConfig", (app, html) => enhanceLightSettings(html));
