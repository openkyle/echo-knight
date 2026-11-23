export const ID = "echo-knight";
export function flag(value) {
  const doc = value?.document ?? value;
  return typeof doc?.getFlag === "function" ? doc.getFlag(ID, "echo") : undefined;
}
export const actionOf = item => item?.getFlag(ID, "action");
export function distanceBetween(scene, a, b) {
  if (typeof scene.grid.measurePath === "function") return scene.grid.measurePath([a, b]).distance;
  if (globalThis.canvas?.scene?.id !== scene.id) throw new Error("View this scene to measure distance.");
  return canvas.grid.measureDistances([{ray: new Ray(a, b)}], {gridSpaces: true})[0];
}
export const center = (doc, gridSize = doc.parent.grid.size) => ({x: doc.x + doc.width * gridSize / 2, y: doc.y + doc.height * gridSize / 2});
export function overlaps(a, b, size) {
  return a.x < b.x + b.width * size - 0.1 && a.x + a.width * size > b.x + 0.1 && a.y < b.y + b.height * size - 0.1 && a.y + a.height * size > b.y + 0.1;
}
export function rangeInScene(value, units, sceneUnits) {
  const feet = ["ft", "feet", "foot"], metres = ["m", "meter", "meters", "metre", "metres"];
  const a = String(units).toLowerCase(), b = String(sceneUnits).toLowerCase();
  if (a === b || (feet.includes(a) && feet.includes(b)) || (metres.includes(a) && metres.includes(b))) return value;
  if (feet.includes(a) && metres.includes(b)) return value * 0.3;
  if (metres.includes(a) && feet.includes(b)) return value / 0.3;
  throw new Error(`Unsupported scene distance units: ${sceneUnits}. Use feet or metres.`);
}
export function checkPlacement(scene, source, point, range, {ignore = [], sight = () => false} = {}) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new Error("Invalid destination.");
  const size = scene.grid.size;
  const bounds = scene.dimensions.sceneRect;
  if (point.x < bounds.x || point.y < bounds.y || point.x + source.width * size > bounds.x + bounds.width || point.y + source.height * size > bounds.y + bounds.height) throw new Error("Choose a space inside the scene.");
  const destination = center({x: point.x, y: point.y, width: source.width, height: source.height}, size);
  const distance = distanceBetween(scene, center(source, size), destination);
  if (distance > range + 0.01) throw new Error("That space is out of range.");
  if (sight(center(source, size), destination)) throw new Error("Choose a space you can see.");
  if (scene.tokens.some(t => !ignore.includes(t.id) && Math.abs((t.elevation ?? 0) - (source.elevation ?? 0)) < 0.01 && overlaps({x: point.x, y: point.y, width: source.width, height: source.height}, t, size))) throw new Error("That space is occupied.");
  return destination;
}
export function assertOwner(user, token) {
  if (!user?.active || !token?.actor || (!user.isGM && !token.actor.testUserPermission(user, "OWNER"))) throw new Error("You do not own this knight.");
  if (flag(token)) throw new Error("Use the original knight's feature.");
}
export class SerialQueue {
  #tails = new Map();
  run(key, operation) {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    this.#tails.set(key, next);
    return next.finally(() => { if (this.#tails.get(key) === next) this.#tails.delete(key); });
  }
}
