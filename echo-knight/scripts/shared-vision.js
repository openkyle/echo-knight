import {ID, flag} from './core.js';
export function sharedOwnership(existing = {}) {
  // Default ownership covers players added later; remove explicit lower overrides.
  return Object.fromEntries([['default', 3], ...Object.keys(existing).filter(id => id !== 'default').map(id => [id, 3])]);
}
export function isSharedEchoVision(token) {
  return !game.user.isGM && !!flag(token.document) && !!token.actor?.getFlag(ID, 'generatedEcho')
    && token.isOwner && token.document.sight.enabled && !token.document.hidden && !!canvas.scene?.tokenVision;
}
let installed = false;
export function installSharedVision() {
  if (installed) return;
  const prototype = CONFIG.Token.objectClass.prototype;
  if (typeof prototype._isVisionSource !== 'function') {
    ui.notifications.error('Echo Knight: shared vision could not initialize on this Foundry version.'); return;
  }
  installed = true;
  if (globalThis.libWrapper?.register) {
    libWrapper.register(ID, 'CONFIG.Token.objectClass.prototype._isVisionSource', function(wrapped, ...args) {
      return isSharedEchoVision(this) || wrapped(...args);
    }, 'MIXED');
  } else {
    const original = prototype._isVisionSource;
    prototype._isVisionSource = function(...args) { return isSharedEchoVision(this) || original.apply(this, args); };
  }
}
export async function migrateSharedEchoes() {
  if (game.users.activeGM?.id !== game.user.id) return;
  for (const actor of game.actors) {
    if (!actor.getFlag(ID, 'generatedEcho')) continue;
    const ownership = sharedOwnership(actor.ownership);
    if (JSON.stringify(actor.ownership) !== JSON.stringify(ownership)) await actor.update({ownership}, {diff:false, recursive:false});
  }
  for (const scene of game.scenes) {
    const updates = scene.tokens.filter(t => flag(t) && t.actor?.getFlag(ID, 'generatedEcho') && !t.sight.enabled)
      .map(t => ({_id:t.id, 'sight.enabled':true}));
    if (updates.length) await scene.updateEmbeddedDocuments('Token', updates);
  }
}
export function hideEchoActors(html) {
  const root = html[0] ?? html;
  for (const row of root.querySelectorAll('[data-document-id], [data-entity-id]')) {
    const id = row.dataset.documentId ?? row.dataset.entityId;
    if (game.actors.get(id)?.getFlag(ID, 'generatedEcho')) row.remove();
  }
}
