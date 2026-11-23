import {ID} from "./core.js";
export async function ensureCompendium() {
  // The registered module pack is available without creating or changing world data.
  const bundled = game.packs.get(`${ID}.echo-knight-features`);
  if (bundled) return bundled;
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const key = "world.echo-knight-features";
  let pack = game.packs.get(key);
  if (!pack) {
    const Compendium = globalThis.CompendiumCollection;
    pack = await Compendium.createCompendium({name: "echo-knight-features", label: "Echo Knight — Features", type: "Item", system: "dnd5e", ownership: {PLAYER: "OBSERVER", TRUSTED: "OBSERVER"}});
  }
  const response = await fetch(`modules/${ID}/data/features.json`);
  if (!response.ok) throw new Error("Could not load bundled echo features.");
  const features = await response.json();
  const index = await pack.getIndex({fields: [`flags.${ID}.action`]});
  const missing = features.filter(f => !index.some(i => i.flags?.[ID]?.action === f.action || i._id === f.id));
  if (!missing.length) return;
  const locked = pack.locked;
  if (locked) await pack.configure({locked: false});
  try {
    const items = missing.map(f => {
      const system = {description: {value: f.description}, type: {value: "class"}, requirements: f.requirements, identifier: f.identifier};
      const activation = {type: f.activation, value: 1, cost: 1};
      const range = {value: f.action === "manifest" ? 15 : null, units: f.action === "manifest" ? "ft" : "self"};
      Object.assign(system, {activation, range, actionType: "other", target: {type: "self"}, uses: {value: null, max: "", per: null}});
      return {_id: f.id, name: f.name, type: "feat", img: f.img, system, flags: {[ID]: {action: f.action}}};
    });
    await Item.createDocuments(items, {pack: pack.collection, keepId: true});
  } finally { if (locked) await pack.configure({locked: true}); }
}
