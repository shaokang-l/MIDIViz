# MIDIViz

MIDIViz is a browser-based MIDI visualizer and lightweight runtime patching environment built with p5.js, Tone.js MIDI parsing, and smplr soundfonts.

The project started as an event-driven MIDI visualization library: `NotePlayer` emits note events, and visualization collections listen to those events to create primitives such as quads, particles, ripples, lines, circular particles, and piano-roll highlights. It now also includes a node editor for mapping MIDI tracks to instruments and visual primitives at runtime.

## Current Status

MIDIViz is becoming a small MIDI-driven visual instrument rather than just a MIDI player. The most interesting part is the runtime graph: tracks, instruments, primitives, piano-roll settings, colors, and track groups can be edited while the sketch is running.

Core features:

- MIDI loading and playback in the browser.
- Runtime node editor for track, instrument, primitive, color, piano-roll, and track-group mapping.
- Draggable nodes with preset import/export.
- Track groups, so one primitive can listen to multiple tracks.
- Piano roll with per-track highlights.
- Playback controls: play, stop, restart, seek, and record canvas to WebM.
- Primitive performance controls, including per-node `Max Items` caps.
- Local MIDI file loading with empty-track filtering and better large-file error messages.

## Quick Start

Serve the repo with any static file server, then open:

```text
src/midiviz_quick/multi_track.html
```

For example:

```sh
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000/src/midiviz_quick/multi_track.html
```

The default node-editor example loads:

```text
assets/alleycat.mid
```

Make sure `alleycat.mid` exists at that path before hosting or opening the example. You can also use the `Load MIDI` button in the UI to load a local `.mid` file.

## GitHub Pages

This project can be hosted directly on GitHub Pages because it is static HTML and browser ES modules.

In your repository settings:

- Go to `Settings` -> `Pages`.
- Choose `Deploy from a branch`.
- Select your branch, usually `main`.
- Select `/root` as the folder.

The page URL will look like:

```text
https://<username>.github.io/<repo>/src/midiviz_quick/multi_track.html
```

## Node Editor Workflow

The main demo is `src/midiviz_quick/node_editor.js`, loaded by `multi_track.html`.

Useful controls:

- `Load MIDI`: load a local MIDI file.
- `Add Track Group`: create a group node that can combine multiple tracks.
- `Colorize Tracks`: assign distinct colors per track.
- `Export Preset` / `Import Preset`: save and restore the graph as JSON.
- `Max Items`: cap active primitives for performance.
- `Record`: record the canvas to a `.webm` file when supported by the browser.

Typical workflow:

1. Load a MIDI file.
2. Use track nodes to select instruments and add primitives.
3. Use track groups when one visual primitive should react to multiple tracks.
4. Adjust color, speed, and max item counts.
5. Export a preset when the mapping feels good.

## Library Usage

Minimal MIDI playback:

```js
import NotePlayer from "../midi_player/NotePlayer.js";

const player = new NotePlayer();
await player.load("../../assets/alleycat.mid");
await player.play();
```

Minimal p5 visualization:

```js
import PianoRollWithPrimitives from "../collections/PianoRollWithPrimitives.js";
import NotePlayer from "../midi_player/NotePlayer.js";
import RuntimeController from "../runtime/RuntimeController.js";

new p5(function (p5) {
    const viz = new PianoRollWithPrimitives(p5, null, true);
    const player = new NotePlayer();
    let controller;

    p5.setup = async function () {
        p5.createCanvas(p5.windowWidth, p5.windowHeight);
        await player.load("../../assets/alleycat.mid");

        controller = new RuntimeController({ player, viz });
        controller.createGraphFromPlayer({ defaultPrimitive: "QuadSet" });
        controller.applyGraph();
    };

    p5.draw = function () {
        if (controller)
            viz.step(p5);
    };
});
```

## Architecture

Important pieces:

- `src/midi_player/NotePlayer.js`: loads MIDI, resolves instruments, schedules playback, and emits note events.
- `src/midi_player/FileHandler.js`: parses MIDI files and converts tracks to MIDIViz note data.
- `src/collections/`: visualization collections that react to note events.
- `src/primitives/`: drawable primitive objects.
- `src/runtime/PatchGraph.js`: JSON-serializable graph model.
- `src/runtime/RuntimeController.js`: applies graph settings to audio playback and visualization.
- `src/gui/NodeEditor.js`: runtime node editor UI.

## Performance Notes

Dense MIDI files can create many visual objects very quickly. MIDIViz includes a few guardrails:

- Collections support `maxItems` and prune older primitives.
- Boundary checks use reverse traversal to avoid expensive `indexOf` scans.
- Playback reuses identical soundfont instances within a playback run.
- Empty MIDI tracks are filtered from the default graph.

For large MIDI files, it still helps to export a clean MIDI from your DAW: remove unused tracks, heavy controller automation, lyrics, and markers if they are not needed for visualization.

## Project Direction

MIDIViz is most compelling as a MIDI-driven visual instrument. Good next features would be pattern presets, beat-synced motion, velocity-to-color/size mappings, drum-specific mapping, named scene presets, and a more direct cable-style node connection UI.
