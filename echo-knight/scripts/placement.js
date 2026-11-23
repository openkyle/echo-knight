import {center, checkPlacement, distanceBetween} from "./core.js";
let cancelCurrent;
export function cancelPlacement() { cancelCurrent?.(); }
export async function pickPosition(token, range) {
  cancelPlacement();
  const stage = canvas.stage, scene = canvas.scene, size = scene.grid.size;
  const origin = center(token.document), graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  canvas.interface.addChild(graphics);
  const color = Number.parseInt(String(game.user.color).replace("#", ""), 16) || 0x70dcff;
  const label = new PIXI.Text("", {fontSize: 20, fill: "#ffffff", stroke: "#000000", strokeThickness: 4});
  label.eventMode = "none";
  canvas.interface.addChild(label);
  const view = canvas.app.view ?? canvas.app.canvas;
  const oldCursor = view.style.cursor;
  view.style.cursor = "crosshair";
  ui.notifications.info("Place your echo: click a valid space. Right-click or Escape to cancel.");
  return new Promise(resolve => {
    let point, valid = false, reason = "Choose a space.";
    const teardown = () => finish(null);
    const teardownId = Hooks.on("canvasTearDown", teardown);
    function finish(result) {
      stage.off("pointermove", move);
      view.removeEventListener("pointerdown", click, true);
      view.removeEventListener("contextmenu", context, true);
      document.removeEventListener("keydown", key, true);
      Hooks.off("canvasTearDown", teardownId);
      graphics.destroy(); label.destroy(); view.style.cursor = oldCursor;
      cancelCurrent = undefined;
      resolve(result);
    }
    function move(event) {
      const p = (event.data ?? event).getLocalPosition(stage);
      point = canvas.grid.getSnappedPosition(p.x - token.w / 2, p.y - token.h / 2, 1, {token});
      try {
        checkPlacement(scene, token.document, point, range, {sight: (a, b) => CONFIG.Canvas.polygonBackends.sight.testCollision(a, b, {type: "sight", mode: "any"})});
        valid = true; reason = "Click to manifest";
      } catch (error) { valid = false; reason = error.message; }
      const target = center({x: point.x, y: point.y, width: token.document.width, height: token.document.height}, size);
      const distance = distanceBetween(scene, origin, target);
      graphics.clear().lineStyle(3, color, 0.8).beginFill(color, 0.06).drawCircle(origin.x, origin.y, range / scene.grid.distance * size).endFill();
      graphics.lineStyle(3, valid ? 0x66ffaa : 0xff5566, 1).drawRect(point.x, point.y, token.w, token.h);
      graphics.moveTo(target.x - 12, target.y).lineTo(target.x + 12, target.y).moveTo(target.x, target.y - 12).lineTo(target.x, target.y + 12);
      label.text = `${Math.round(distance * 10) / 10} / ${range} ${scene.grid.units} · ${reason}`;
      label.position.set(target.x + token.w / 2 + 10, target.y);
    }
    function click(event) {
      if (![0, 2].includes(event.button)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.button === 2) finish(null);
      else if (valid && point) finish(point);
      else ui.notifications.warn(reason);
    }
    function context(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    function key(event) { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(null); } }
    stage.on("pointermove", move);
    view.addEventListener("pointerdown", click, true);
    view.addEventListener("contextmenu", context, true);
    document.addEventListener("keydown", key, true);
    cancelCurrent = () => finish(null);
    graphics.lineStyle(3, color, 0.8).drawCircle(origin.x, origin.y, range / scene.grid.distance * size);
  });
}
