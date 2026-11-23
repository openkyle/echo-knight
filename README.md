# Echo Knight — Manifest & Swap

Built for **Foundry VTT 11 (315) and D&D5e 2.4.1**. Requires a V11-compatible Socketlib (1.0.13 is suitable). Sequencer is optional for custom animation files/database keys. No paid animation pack is required for built-in effects.

## Install

In Foundry Setup → Add-on Modules → Install Module, paste this manifest URL:

```text
https://raw.githubusercontent.com/openkyle/echo-knight/main/echo-knight/module.json
```

For manual installation:

1. Extract the ZIP into your Foundry user-data `Data/modules` directory. The manifest must end up at `Data/modules/echo-knight/module.json`.
2. Restart Foundry. Enable **Socketlib** and **Echo Knight — Manifest & Swap** in your world, then reload.
3. Open the world with the module enabled. The bundled **Echo Knight — Features** compendium appears in Compendium Packs. Search for “Echo Knight” if your sidebar groups it inside a folder. No startup creation step is required.
4. Drag **Manifest Echo**, **Echo Avatar**, **Recall Echo**, and **Swap with Echo** onto the knight's sheet. Replace any old unautomated copies you intend to use. Existing similarly named items are not modified automatically.
5. Keep a GM connected and viewing the same scene for manifest/swap validation. Players need Owner permission on their knight, but do not need token/actor creation or deletion permissions.

On Forge, upload the extracted module using your normal custom-module import workflow. The manifest URL above also provides a direct download of the packaged ZIP.

## Use

Select the knight and use **Manifest Echo** from its sheet/hotbar. Pick a space with the crosshair. A range ring, measured distance, and green/red destination outline guide placement. Escape or right-click cancels. Range uses the scene's configured grid measurement; on grids with non-Euclidean diagonals, the circle is a visual reference and the measured distance/green outline determines validity. Walls blocking sight, occupied spaces at the same elevation, and destinations outside the scene are rejected. Lighting and special visibility effects remain GM-adjudicated.

The echo copies token artwork and size, is translucent, has 1 HP and AC 14 + proficiency, and uses a separate generated actor so damage cannot affect the knight. The generated actor carries a snapshot of the knight's sheet; changes to the original later are reflected when the echo is manifested again. One echo per source token is supported. Generated actors are removed when their last echo token is deleted; orphaned records are cleaned up on GM load.

Right-click either the echo or original knight:

- **Two arrows:** exchange positions and elevation, without sliding animation.
- **X:** dismiss the echo. The original knight is never deleted.
- **Eye:** toggle Echo Avatar, when the knight has that feature.

**Echo Avatar** focuses the echo and enables its sight. The activating player's color marks the occupied echo with a glow. Use again to return focus and end the glow. In settings, choose the original knight or both tokens as the glow target instead. Dismissing, destroying, or replacing the echo ends that avatar state. The original body's blindness/deafness and duration are not automatically imposed.

Reducing the echo's HP to 0 or below removes its scene token. If the GM was offline, cleanup runs when a GM returns to the world/scene. Manual token deletion also cleans up its generated actor. The echo need not be in combat.

## TokenMagic body effect (1.0.2)

Enable a V11-compatible **Token Magic FX** module. Under **Configure Settings → Echo Knight**, check **Enable TokenMagic effect on echoes** and choose **Echo TokenMagic portfolio effect**. The default is **26 – T01 – Spectral Body (liquid) — supplied preset**, using the supplied blue/white liquid parameters exactly. It is available without importing the portfolio macro.

The dropdown also discovers Macro compendiums whose package or label identifies TokenMagic/TMFX, including the TokenMagic Portfolio. Select a macro with a literal `let params = [...]` (or `const`/`var`) definition. Hex colors, comments, nested animation objects, and trailing commas are supported. Macros that calculate parameters with functions or expressions are unsupported and report an error; the module never executes a portfolio macro or changes selected-token state.

The effect is persistent on the echo, separate from one-shot phase animations and the avatar glow. The active GM applies it. Settings changes update echoes on the current scene; other scenes update when the GM views them. Disabling the checkbox removes only Echo Knight's own filters. Existing custom TokenMagic filters are preserved. The normal echo opacity setting still applies, so raise it if the spectral body looks too faint.

## Native echo lighting (1.0.3)

The automatic gray-blue token image tint is removed. New echoes use neutral white (no image tint); existing echoes with the old module tint are migrated when the GM loads the world. The TokenMagic Spectral Body animation retains its own blue/white colors.

In **Configure Settings → Echo Knight**, set the echo light's **dim radius**, **bright radius**, **emission angle**, **color** (with picker), and **color intensity**, just like the basic Light tab in Token Configuration. Radii use scene distance units. Both radii default to 0 (off), angle to 360°, color to blank, and intensity to 0.5. The animation dropdown comes from Foundry's installed light animations, with speed, intensity, and reverse controls. These are native token lights and need no effects module.

Saving lighting settings updates existing echoes across scenes through the active GM. New echoes use the same defaults. You can still edit a particular echo's native Light tab, including Advanced Options; those individual edits survive reloads until you change the module lighting defaults again.

## Customization

Under **Configure Settings → Echo Knight — Manifest & Swap** configure:

- Echo opacity and optional token image/video override (blank copies the knight).
- Avatar glow target.
- Built-in animated pulse effects and global sound volume.
- Separate animation and audio for manifest, swap departure, swap arrival, avatar enter, avatar return, recall, and destruction.

A custom animation path or Sequencer database entry requires a V11-compatible Sequencer. Audio uses Foundry's audio playback and does not require Sequencer. Effects and sounds play once on each client viewing the scene. Blank sounds are silent; no external media is bundled. Browser audio autoplay restrictions may require clicking the game first.

Items remain normal editable D&D5e features. Rename or edit descriptions, icons, activation labels, and Manifest Echo's range normally. The automation follows `flags.echo-knight.action`, not the name. The item's range takes precedence over the default range setting. Removing the flag removes automation.

These items intercept normal item use to perform the echo action. Bonus actions, swap's 15-foot movement cost, resource consumption, attacks, reactions, end-of-turn distance limits, avatar duration/1000-foot limit, and Legion of One are **not** automated. Effects configured on the normal item are not automatically applied by this workflow; use the module's phase settings for audiovisual effects.

For older installations without the bundled pack, the active GM can run this recovery command:

```js
await game.modules.get("echo-knight").api.repairCompendium();
```

## Validation

Automated tests cover geometry, V11 measurement integration, permission checks, per-knight serialization, independent HP and AC, swap, avatar, recall, replacement, failed-creation rollback, and idempotent compendium provisioning. JavaScript syntax and the archive are checked. A live licensed Foundry runtime was not available here; actual V11 canvas rendering and compatibility with your other modules still need an in-world smoke test.

Use a GM and a player session to confirm:

1. Import all four items; rename Manifest Echo; use it as the owning player.
2. Cancel placement, then try a valid, occupied, blocked, and out-of-range space.
3. Right-click the echo as the player and swap; check both positions and original HP.
4. Toggle Avatar twice; verify glow color, focus and vision, including after refreshing.
5. Recall with X, then re-manifest and set echo HP to 0; confirm its actor is cleaned up.
6. Set one sound and one animation; confirm both clients receive them once.
7. Try another player's knight without Owner permission; the action must be rejected.

## Implementation references

- [D&D5e 2.4.1 item use hook](https://github.com/foundryvtt/dnd5e/blob/release-2.4.1/module/documents/item.mjs)
- [Foundry V11 grid API](https://foundryvtt.com/api/v11/classes/client.GridLayer.html)
- [Socketlib 1.0.13](https://github.com/manuelVo/foundryvtt-socketlib/tree/v1.0.13)

The archived Full Speed Ahead module was inspected for its crosshair and range-overlay interaction. That archive contained targeting and vehicle movement, but no teleport implementation. This module has no Full Speed Ahead dependency.
