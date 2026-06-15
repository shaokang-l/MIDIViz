import { INSTRUMENTS, SOUNDFONT_INSTRUMENTS } from "../midi_player/Instruments.js";
import { NODE_TYPES } from "../runtime/PatchGraph.js";
import { PRIMITIVE_TYPES } from "../runtime/RuntimeController.js";

class NodeEditor {
    constructor({ graph, controller, mount = document.body, onPlay = null, onStop = null, onSeek = null, onRecordStart = null, onRecordStop = null, onLoadMidiFile = null, getDuration = null, getCurrentTime = null }) {
        this.graph = graph;
        this.controller = controller;
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onSeek = onSeek;
        this.onRecordStart = onRecordStart;
        this.onRecordStop = onRecordStop;
        this.onLoadMidiFile = onLoadMidiFile;
        this.getDuration = getDuration;
        this.getCurrentTime = getCurrentTime;
        this.seekSeconds = 0;
        this.isRecording = false;
        this.isGraphVisible = true;
        this.root = document.createElement("section");
        this.root.className = "midiviz-node-editor";
        this.root.setAttribute("aria-label", "MIDIViz Node Editor");
        mount.appendChild(this.root);
        this.controlsRoot = document.createElement("section");
        this.controlsRoot.className = "node-editor-controls";
        mount.appendChild(this.controlsRoot);
        this.statusMessage = "";
        this.injectStyles();
        this.render();
        window.setInterval(() => this.updatePlaybackDisplay(), 250);
    }

    setGraph(graph) {
        this.graph = graph;
        this.controller.setGraph(graph);
        this.render();
    }

    render() {
        this.root.replaceChildren();
        this.controlsRoot.replaceChildren();

        const toolbar = document.createElement("div");
        toolbar.className = "node-editor-toolbar";
        toolbar.append(
            this.createButton(this.isGraphVisible ? "Hide Graph" : "Show Graph", () => this.setGraphVisible(!this.isGraphVisible)),
            this.createFileInput("Load MIDI", ".mid,.midi", async (file) => {
                if (this.onLoadMidiFile)
                    await this.onLoadMidiFile(file, this);
            }),
            this.createButton("Add Track Group", () => this.addTrackGroup()),
            this.createButton("Colorize Tracks", () => this.colorizeTracks()),
            this.createButton("Export Preset", () => this.exportJson()),
            this.createFileInput("Import Preset", "application/json,.json", async (file) => {
                await this.importJsonFile(file);
            }),
        );

        const playbackControls = this.createPlaybackControls();
        const status = document.createElement("div");
        status.className = "node-editor-status";
        status.textContent = this.statusMessage;
        this.statusElement = status;
        this.controlsRoot.append(toolbar, playbackControls, status);

        const canvas = document.createElement("div");
        canvas.className = "node-editor-canvas";
        const canvasSize = this.getCanvasSize();
        canvas.style.width = `${canvasSize.width}px`;
        canvas.style.height = `${canvasSize.height}px`;
        this.edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.edgeLayer.classList.add("node-editor-edges");
        this.edgeLayer.setAttribute("width", String(canvasSize.width));
        this.edgeLayer.setAttribute("height", String(canvasSize.height));
        canvas.appendChild(this.edgeLayer);

        this.graph.nodes.forEach(node => {
            canvas.appendChild(this.createNodeCard(node));
        });

        this.root.append(canvas);
        this.renderEdges();
        this.updatePlaybackDisplay();
    }

    createPlaybackControls() {
        const controls = document.createElement("div");
        controls.className = "node-editor-playback";

        const duration = this.readDuration();
        const seek = document.createElement("input");
        seek.type = "range";
        seek.min = "0";
        seek.max = String(Math.max(1, Math.ceil(duration)));
        seek.step = "0.1";
        seek.value = String(this.seekSeconds);
        seek.addEventListener("input", () => {
            this.seekSeconds = Number(seek.value);
            this.updatePlaybackDisplay();
        });
        seek.addEventListener("change", async () => {
            this.seekSeconds = Number(seek.value);
            if (this.onSeek)
                await this.onSeek(this.seekSeconds);
            this.updatePlaybackDisplay();
        });
        this.seekInput = seek;

        const label = document.createElement("span");
        label.className = "node-editor-time";
        this.playbackLabel = label;

        const seekGroup = document.createElement("div");
        seekGroup.className = "node-editor-seek-group";
        seekGroup.append(seek, label);

        controls.append(
            this.createButton("Play", async () => {
                this.applyGraph();
                if (this.onPlay)
                    await this.onPlay(this.seekSeconds);
            }),
            this.createButton("Stop", () => {
                if (this.onStop)
                    this.onStop();
                this.updatePlaybackDisplay();
            }),
            this.createButton("Restart", async () => {
                this.seekSeconds = 0;
                this.applyGraph();
                if (this.onPlay)
                    await this.onPlay(0);
            }),
            this.createButton("+10s", async () => {
                const target = Math.min(this.readDuration(), this.seekSeconds + 10);
                this.seekSeconds = target;
                if (this.onSeek)
                    await this.onSeek(target);
                this.updatePlaybackDisplay();
            }),
            seekGroup,
            this.createButton(this.isRecording ? "Stop Rec" : "Record", () => this.toggleRecording()),
        );

        return controls;
    }

    setStatus(message) {
        this.statusMessage = message;
        if (this.statusElement)
            this.statusElement.textContent = message;
    }

    getCanvasSize() {
        const padding = 80;
        const width = Math.max(window.innerWidth - 24, ...this.graph.nodes.map(node => node.position.x + this.getNodeWidth(node) + padding));
        const height = Math.max(window.innerHeight - 24, ...this.graph.nodes.map(node => node.position.y + this.getNodeHeight(node) + padding));

        return { width, height };
    }

    getNodeWidth(node) {
        return node.type === NODE_TYPES.PIANO_ROLL ? 560 : 220;
    }

    getNodeHeight(node) {
        if (node.type === NODE_TYPES.INSTRUMENT)
            return 360;
        if (node.type === NODE_TYPES.TRACK_GROUP)
            return 340;
        if (node.type === NODE_TYPES.PIANO_ROLL)
            return 280;
        return 220;
    }

    createNodeCard(node) {
        const card = document.createElement("article");
        card.className = `node-card node-card-${node.type}`;
        card.style.left = `${node.position.x}px`;
        card.style.top = `${node.position.y}px`;
        card.dataset.nodeId = node.id;

        const title = document.createElement("h3");
        title.className = "node-drag-handle";
        title.textContent = node.label || node.type;
        card.appendChild(title);
        this.makeDraggable(card, node, title);

        if (node.type === NODE_TYPES.TRACK)
            this.renderTrackNode(card, node);
        else if (node.type === NODE_TYPES.TRACK_GROUP)
            this.renderTrackGroupNode(card, node);
        else if (node.type === NODE_TYPES.INSTRUMENT)
            this.renderInstrumentNode(card, node);
        else if (node.type === NODE_TYPES.PRIMITIVE)
            this.renderPrimitiveNode(card, node);
        else if (node.type === NODE_TYPES.COLOR)
            this.renderColorNode(card, node);
        else if (node.type === NODE_TYPES.MOTION)
            this.renderMotionNode(card, node);
        else if (node.type === NODE_TYPES.PIANO_ROLL)
            this.renderPianoRollNode(card, node);

        return card;
    }

    renderTrackNode(card, node) {
        card.appendChild(this.createMeta(`Track ${node.params.trackIndex}`));
        if (node.params.rawName && node.params.rawName !== node.label && !this.looksLikeMojibake(node.params.rawName))
            card.appendChild(this.createMeta(`MIDI name: ${node.params.rawName}`));
        if (node.params.rawInstrument && node.params.rawInstrument !== node.label && !this.looksLikeMojibake(node.params.rawInstrument))
            card.appendChild(this.createMeta(`MIDI instrument: ${node.params.rawInstrument}`));
        if (node.params.resolvedInstrument && node.params.resolvedInstrument !== node.params.rawInstrument)
            card.appendChild(this.createMeta(`Soundfont: ${node.params.resolvedInstrument}`));
        card.appendChild(this.createMeta(`${node.params.noteCount || 0} notes`));

        const instrument = this.getInstrumentForTrack(node);
        const select = this.createSelect(this.getInstrumentOptions(instrument), instrument, (value) => {
            this.controller.updateTrackInstrument(node.id, value);
            this.render();
        });
        card.appendChild(this.createField("Instrument", select));

        const primitiveSelect = this.createSelect(Object.keys(PRIMITIVE_TYPES), "QuadSet");
        const addButton = this.createButton("Add Primitive", () => {
            this.controller.addPrimitiveForTrack(node.id, primitiveSelect.value);
            this.render();
        });
        card.appendChild(this.createField("New Primitive", primitiveSelect));
        card.appendChild(addButton);
    }

    renderTrackGroupNode(card, node) {
        const selected = node.params.trackIndices || [];
        card.appendChild(this.createMeta(`${selected.length} tracks selected`));

        const members = document.createElement("div");
        members.className = "track-group-members";
        this.graph.getNodesByType(NODE_TYPES.TRACK).forEach(trackNode => {
            const trackIndex = trackNode.params.trackIndex;
            const checkbox = this.createCheckbox(selected.includes(trackIndex), (checked) => {
                const next = new Set(node.params.trackIndices || []);
                if (checked)
                    next.add(trackIndex);
                else
                    next.delete(trackIndex);

                this.graph.updateNode(node.id, { params: { trackIndices: [...next].sort((a, b) => a - b) } });
                this.syncTrackGroupConnections(node);
                this.applyAndRender();
            });
            members.appendChild(this.createInlineField(trackNode.label || `Track ${trackIndex}`, checkbox));
        });
        card.appendChild(members);

        const primitiveSelect = this.createSelect(Object.keys(PRIMITIVE_TYPES), "QuadSet");
        card.appendChild(this.createField("New Primitive", primitiveSelect));
        card.appendChild(this.createButton("Add Primitive", () => {
            this.addPrimitiveForTrackGroup(node.id, primitiveSelect.value);
        }));
        card.appendChild(this.createButton("Remove Group", () => {
            this.graph.removeNode(node.id);
            this.applyAndRender();
        }));
    }

    renderInstrumentNode(card, node) {
        const trackNode = this.graph.findFirstUpstreamNode(node.id, NODE_TYPES.TRACK);
        card.appendChild(this.createMeta(trackNode ? `From track ${trackNode.params.trackIndex}` : "No track"));

        const currentInstrument = node.params.instrument || "piano";
        const instrumentSelect = this.createSelect(this.getInstrumentOptions(currentInstrument), currentInstrument, (instrument) => {
            this.graph.updateNode(node.id, {
                label: instrument,
                params: { ...node.params, instrument },
            });
            this.applyAndRender();
        });

        card.appendChild(this.createField("Instrument", instrumentSelect));
        card.appendChild(this.createField("Delay sec", this.createNumberInput(node.params.delay || 0, 0.01, (value) => {
            this.updateNodeParam(node.id, "delay", value);
        })));
        card.appendChild(this.createField("Sustain sec", this.createNumberInput(node.params.sustain || 0, 0.05, (value) => {
            this.updateNodeParam(node.id, "sustain", value);
        })));
        card.appendChild(this.createField("Reverb", this.createNumberInput(node.params.reverb === undefined ? 0.3 : node.params.reverb, 0.05, (value) => {
            this.updateNodeParam(node.id, "reverb", value);
        }, { min: 0, max: 1 })));
        card.appendChild(this.createField("Pitch Shift", this.createNumberInput(node.params.shift || 0, 1, (value) => {
            this.updateNodeParam(node.id, "shift", value);
        })));
        card.appendChild(this.createField("Velocity", this.createNumberInput(node.params.velocityScale || 1, 0.05, (value) => {
            this.updateNodeParam(node.id, "velocityScale", value);
        }, { min: 0, max: 2 })));
    }

    renderPrimitiveNode(card, node) {
        const sourceNodes = [...this.graph.getNodesByType(NODE_TYPES.TRACK), ...this.graph.getNodesByType(NODE_TYPES.TRACK_GROUP)];
        const groupNode = this.graph.findFirstUpstreamNode(node.id, NODE_TYPES.TRACK_GROUP);
        const trackNode = groupNode ? null : this.graph.findFirstUpstreamNode(node.id, NODE_TYPES.TRACK);
        if (groupNode)
            card.appendChild(this.createMeta(`Linked from ${groupNode.label}`));
        else if (trackNode)
            card.appendChild(this.createMeta(`Linked from Track ${trackNode.params.trackIndex}`));
        const currentSourceId = groupNode ? groupNode.id : (trackNode ? trackNode.id : (sourceNodes[0] ? sourceNodes[0].id : ""));
        const sourceSelect = this.createSelect(sourceNodes.map(source => ({
            label: source.type === NODE_TYPES.TRACK_GROUP ? source.label : `Track ${source.params.trackIndex}`,
            value: source.id,
        })), currentSourceId, (sourceId) => {
            const selectedSource = this.graph.getNode(sourceId);
            const sourceNode = selectedSource.type === NODE_TYPES.TRACK_GROUP ? selectedSource : this.controller.getOrCreateInstrumentForTrack(selectedSource);
            this.graph.replaceIncoming(node.id, sourceNode.id, {
                fromPort: selectedSource.type === NODE_TYPES.TRACK_GROUP ? "group" : "audio",
                toPort: "viz",
            });
            this.applyAndRender();
        });

        const typeSelect = this.createSelect(Object.keys(PRIMITIVE_TYPES), node.params.primitiveType || node.label, (primitiveType) => {
            this.graph.updateNode(node.id, {
                label: primitiveType,
                params: {
                    primitiveType,
                    maxItems: node.params.maxItems || this.getDefaultMaxItems(primitiveType),
                },
            });
            this.applyAndRender();
        });

        const speedInput = document.createElement("input");
        speedInput.type = "number";
        speedInput.step = "0.005";
        speedInput.value = node.params.speedScale || 5e-2;
        speedInput.addEventListener("change", () => {
            this.graph.updateNode(node.id, { params: { speedScale: Number(speedInput.value) } });
            this.applyAndRender();
        });

        const maxItemsInput = this.createNumberInput(node.params.maxItems || this.getDefaultMaxItems(node.params.primitiveType || node.label), 100, (value) => {
            this.graph.updateNode(node.id, { params: { maxItems: Math.max(1, Math.floor(value)) } });
            this.applyAndRender();
        }, { min: 1 });

        const listenInput = document.createElement("input");
        listenInput.type = "checkbox";
        listenInput.checked = Boolean(node.params.listenToAll);
        listenInput.addEventListener("change", () => {
            this.graph.updateNode(node.id, { params: { listenToAll: listenInput.checked } });
            this.applyAndRender();
        });

        const colorInput = this.createPaletteColorInput(this.getPrimitiveColor(node), (color) => {
            this.updatePrimitiveColor(node, color);
            this.applyAndRender();
        }, node.id);

        card.appendChild(this.createField("Source", sourceSelect));
        card.appendChild(this.createField("Type", typeSelect));
        card.appendChild(this.createField("Speed", speedInput));
        card.appendChild(this.createField("Max Items", maxItemsInput));
        card.appendChild(this.createField("Listen All", listenInput));
        card.appendChild(this.createField("Color", colorInput));
        card.appendChild(this.createButton("Remove", () => {
            this.controller.removePrimitive(node.id);
            this.render();
        }));
    }

    renderColorNode(card, node) {
        const input = document.createElement("input");
        input.type = "color";
        input.value = this.rgbToHex(node.params.color || [255, 255, 255]);
        input.addEventListener("change", () => {
            this.graph.updateNode(node.id, { params: { color: this.hexToRgb(input.value) } });
            this.applyAndRender();
        });
        card.appendChild(this.createField("Color", input));
    }

    renderMotionNode(card, node) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.005";
        input.value = node.params.speedScale || 5e-2;
        input.addEventListener("change", () => {
            this.graph.updateNode(node.id, { params: { speedScale: Number(input.value) } });
            this.applyAndRender();
        });
        card.appendChild(this.createField("Speed", input));
    }

    renderPianoRollNode(card, node) {
        const params = node.params || {};
        card.appendChild(this.createField("Enable", this.createCheckbox(params.enable !== false && params.visible !== false, (enable) => {
            this.updateNodeParam(node.id, "enable", enable);
        })));
        card.appendChild(this.createField("Highlight Mode", this.createSelect([
            { label: "Per Track", value: "track" },
            { label: "Uniform", value: "uniform" },
        ], params.highlightMode || "track", (mode) => {
            this.updateNodeParam(node.id, "highlightMode", mode);
        })));
        card.appendChild(this.createField("Height", this.createNumberInput(params.height || 100, 5, (value) => {
            this.updateNodeParam(node.id, "height", value, { rerender: false });
        }, { min: 20, max: 300 })));
        card.appendChild(this.createField("White Keys", this.createColorInput(params.whiteKeyColor || [255, 255, 255], (color) => {
            this.updateNodeParam(node.id, "whiteKeyColor", color, { rerender: false });
        })));
        card.appendChild(this.createField("Black Keys", this.createColorInput(params.blackKeyColor || [0, 0, 0], (color) => {
            this.updateNodeParam(node.id, "blackKeyColor", color, { rerender: false });
        })));
        if ((params.highlightMode || "track") === "uniform") {
            card.appendChild(this.createField("Highlight", this.createColorInput(params.highlightColor || [69, 202, 255], (color) => {
                this.updateNodeParam(node.id, "highlightColor", color, { rerender: false });
            })));
        }
    }

    renderEdges() {
        this.edgeLayer.replaceChildren();
        this.graph.connections.forEach(connection => {
            const from = this.graph.getNode(connection.from.nodeId);
            const to = this.graph.getNode(connection.to.nodeId);
            if (!from || !to)
                return;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const x1 = from.position.x + this.getNodeWidth(from);
            const y1 = from.position.y + 42;
            const x2 = to.position.x;
            const y2 = to.position.y + 42;
            const mid = (x1 + x2) / 2;
            line.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
            line.setAttribute("fill", "none");
            line.classList.add("node-edge");
            if (from.type === NODE_TYPES.TRACK_GROUP || to.type === NODE_TYPES.TRACK_GROUP)
                line.classList.add("node-edge-group");
            if (connection.to.port === "member")
                line.classList.add("node-edge-member");
            this.edgeLayer.appendChild(line);
        });
    }

    async toggleRecording() {
        if (this.isRecording) {
            if (this.onRecordStop)
                this.onRecordStop();
            this.isRecording = false;
        }
        else {
            if (this.onRecordStart) {
                const didStart = await this.onRecordStart();
                if (didStart === false)
                    return;
            }
            this.isRecording = true;
        }
        this.render();
    }

    updatePlaybackDisplay() {
        if (!this.playbackLabel)
            return;

        const duration = this.readDuration();
        const current = document.activeElement === this.seekInput ? this.seekSeconds : this.readCurrentTime();
        this.seekSeconds = Math.min(duration, Math.max(0, current));

        if (this.seekInput && document.activeElement !== this.seekInput) {
            this.seekInput.max = String(Math.max(1, Math.ceil(duration)));
            this.seekInput.value = String(this.seekSeconds);
        }

        this.playbackLabel.textContent = `${this.formatTime(this.seekSeconds)} / ${this.formatTime(duration)}`;
    }

    readDuration() {
        if (!this.getDuration)
            return 0;

        try {
            return this.getDuration();
        }
        catch (error) {
            console.warn("MIDIViz NodeEditor duration unavailable", error);
            return 0;
        }
    }

    readCurrentTime() {
        if (!this.getCurrentTime)
            return this.seekSeconds;

        try {
            return this.getCurrentTime();
        }
        catch (error) {
            console.warn("MIDIViz NodeEditor current time unavailable", error);
            return this.seekSeconds;
        }
    }

    formatTime(seconds) {
        const safeSeconds = Math.max(0, Number(seconds) || 0);
        const mins = Math.floor(safeSeconds / 60);
        const secs = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
        return `${mins}:${secs}`;
    }

    makeDraggable(card, node, handle) {
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;

        handle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            originX = node.position.x;
            originY = node.position.y;
            card.setPointerCapture(e.pointerId);
            card.classList.add("is-dragging");

            const onMove = (moveEvent) => {
                const x = Math.max(0, originX + moveEvent.clientX - startX);
                const y = Math.max(0, originY + moveEvent.clientY - startY);
                node.position.x = x;
                node.position.y = y;
                card.style.left = `${x}px`;
                card.style.top = `${y}px`;
                this.renderEdges();
            };

            const onUp = (upEvent) => {
                this.graph.updateNode(node.id, { position: node.position });
                card.classList.remove("is-dragging");
                card.releasePointerCapture(upEvent.pointerId);
                card.removeEventListener("pointermove", onMove);
                card.removeEventListener("pointerup", onUp);
                card.removeEventListener("pointercancel", onUp);
            };

            card.addEventListener("pointermove", onMove);
            card.addEventListener("pointerup", onUp);
            card.addEventListener("pointercancel", onUp);
        });
    }

    applyAndRender() {
        this.applyGraph();
        this.render();
    }

    applyGraph() {
        this.controller.applyGraph();
    }

    setGraphVisible(visible) {
        this.isGraphVisible = visible;
        this.root.classList.toggle("is-hidden", !visible);
        this.render();
    }

    addTrackGroup() {
        const tracks = this.graph.getNodesByType(NODE_TYPES.TRACK);
        const trackIndices = tracks.slice(0, Math.min(2, tracks.length)).map(track => track.params.trackIndex);
        const group = this.graph.addTrackGroup(trackIndices, {
            position: {
                x: 300,
                y: 220 + this.graph.getNodesByType(NODE_TYPES.TRACK_GROUP).length * 260,
            },
        });
        this.syncTrackGroupConnections(group);
        this.render();
    }

    syncTrackGroupConnections(groupNode) {
        this.graph.connections = this.graph.connections.filter(connection => !(connection.to.nodeId === groupNode.id && connection.to.port === "member"));
        this.graph.getNodesByType(NODE_TYPES.TRACK)
            .filter(trackNode => (groupNode.params.trackIndices || []).includes(trackNode.params.trackIndex))
            .forEach(trackNode => {
                this.graph.connect(trackNode.id, groupNode.id, { fromPort: "midi", toPort: "member" });
            });
    }

    addPrimitiveForTrackGroup(groupNodeId, primitiveType) {
        const groupNode = this.graph.getNode(groupNodeId);
        if (!groupNode) {
            this.setStatus("Could not add primitive: track group was not found.");
            return;
        }

        const siblingCount = this.graph.getConnectionsFrom(groupNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .filter(node => node && node.type === NODE_TYPES.PRIMITIVE)
            .length;
        const primitiveNode = this.graph.addNode({
            type: NODE_TYPES.PRIMITIVE,
            label: primitiveType,
            position: {
                x: groupNode.position.x + 300 + siblingCount * 260,
                y: groupNode.position.y,
            },
            params: {
                primitiveType,
                speedScale: 5e-2,
                listenToAll: false,
                maxItems: this.getDefaultMaxItems(primitiveType),
                color: [69, 202, 255],
            },
        });
        this.graph.connect(groupNode.id, primitiveNode.id, { fromPort: "group", toPort: "viz" });
        this.setStatus(`Added ${primitiveType} for ${groupNode.label}.`);
        this.applyAndRender();
    }

    colorizeTracks() {
        const palette = [
            [69, 202, 255],
            [255, 147, 15],
            [255, 27, 107],
            [137, 255, 99],
            [190, 124, 255],
            [255, 238, 88],
            [64, 224, 208],
            [255, 128, 171],
        ];

        this.graph.getNodesByType(NODE_TYPES.PRIMITIVE).forEach(primitiveNode => {
            const trackNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.TRACK);
            const trackIndex = trackNode && trackNode.params ? trackNode.params.trackIndex : 0;
            const color = palette[trackIndex % palette.length];
            this.graph.updateNode(primitiveNode.id, { params: { color: [...color] } });
        });

        this.graph.getNodesByType(NODE_TYPES.PIANO_ROLL).forEach(pianoRollNode => {
            this.graph.updateNode(pianoRollNode.id, { params: { highlightMode: "track" } });
        });

        this.setStatus("Assigned distinct colors by track.");
        this.applyAndRender();
    }

    getDefaultMaxItems(primitiveType) {
        if (this.controller && this.controller.getDefaultMaxItems)
            return this.controller.getDefaultMaxItems(primitiveType);
        if (primitiveType === "ParticleSet" || primitiveType === "CircularParticleSet")
            return 2000;
        if (primitiveType === "RippleSet")
            return 600;
        if (primitiveType === "LineSet")
            return 800;
        return 1200;
    }

    getPrimitiveNodesForTrack(trackNode) {
        return this.graph.getConnectionsFrom(trackNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .filter(node => node && node.type === NODE_TYPES.INSTRUMENT)
            .flatMap(instrumentNode => this.graph.getConnectionsFrom(instrumentNode.id)
                .map(connection => this.graph.getNode(connection.to.nodeId))
                .filter(node => node && node.type === NODE_TYPES.PRIMITIVE));
    }

    exportJson() {
        const blob = new Blob([JSON.stringify(this.graph.serialize(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `midiviz-preset-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    importJson() {
        return;
    }

    async importJsonFile(file) {
        const data = JSON.parse(await file.text());
        this.controller.setGraph(data);
        this.graph = this.controller.graph;
        this.graph.autoLayout();
        this.applyAndRender();
    }

    getInstrumentForTrack(trackNode) {
        const instrumentNode = this.graph.getConnectionsFrom(trackNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .find(node => node && node.type === NODE_TYPES.INSTRUMENT);

        return instrumentNode ? instrumentNode.params.instrument : "piano";
    }

    getPrimitiveColor(primitiveNode) {
        const colorNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.COLOR);
        return primitiveNode.params.color || (colorNode ? colorNode.params.color : [69, 202, 255]);
    }

    updatePrimitiveColor(primitiveNode, color) {
        this.graph.updateNode(primitiveNode.id, { params: { color } });
    }

    createField(label, input) {
        const field = document.createElement("label");
        field.className = "node-field";
        const span = document.createElement("span");
        span.textContent = label;
        field.append(span, input);
        return field;
    }

    createInlineField(label, input) {
        const field = document.createElement("label");
        field.className = "node-inline-field";
        const span = document.createElement("span");
        span.textContent = label;
        field.append(input, span);
        return field;
    }

    createMeta(text) {
        const meta = document.createElement("p");
        meta.className = "node-meta";
        meta.textContent = text;
        return meta;
    }

    createButton(label, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    createFileInput(label, accept, onFile) {
        const wrapper = document.createElement("label");
        wrapper.className = "node-editor-file-button";
        wrapper.textContent = label;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.addEventListener("change", async () => {
            const file = input.files && input.files[0];
            if (file) {
                this.setStatus(`Loading ${file.name}...`);
                try {
                    const result = await onFile(file);
                    this.setStatus(result || `Loaded ${file.name}`);
                }
                catch (error) {
                    console.error(error);
                    this.setStatus(`Failed to load ${file.name}: ${error.message || error}`);
                }
            }
            input.value = "";
        });
        wrapper.appendChild(input);
        return wrapper;
    }

    createNumberInput(value, step, onChange, options = {}) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = String(step);
        input.value = String(value);
        if (options.min !== undefined)
            input.min = String(options.min);
        if (options.max !== undefined)
            input.max = String(options.max);
        input.addEventListener("change", () => onChange(Number(input.value)));
        return input;
    }

    createCheckbox(checked, onChange) {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(checked);
        input.addEventListener("change", () => onChange(input.checked));
        return input;
    }

    createColorInput(color, onChange) {
        const input = document.createElement("input");
        input.type = "color";
        input.value = this.rgbToHex(color);
        input.addEventListener("change", () => onChange(this.hexToRgb(input.value)));
        return input;
    }

    createPaletteColorInput(color, onChange, excludeNodeId = null) {
        const wrapper = document.createElement("div");
        wrapper.className = "node-color-palette";

        const input = this.createColorInput(color, onChange);
        wrapper.appendChild(input);

        const palette = this.getPaletteColors(excludeNodeId);
        if (palette.length > 0) {
            const swatches = document.createElement("div");
            swatches.className = "node-color-swatches";
            palette.forEach(paletteColor => {
                const swatch = document.createElement("button");
                swatch.type = "button";
                swatch.className = "node-color-swatch";
                swatch.title = this.rgbToHex(paletteColor);
                swatch.style.background = this.rgbToHex(paletteColor);
                swatch.addEventListener("click", () => onChange(paletteColor));
                swatches.appendChild(swatch);
            });
            wrapper.appendChild(swatches);
        }

        return wrapper;
    }

    getPaletteColors(excludeNodeId = null) {
        const seen = new Set();
        const colors = [];

        this.graph.getNodesByType(NODE_TYPES.PRIMITIVE).forEach(node => {
            if (node.id === excludeNodeId || !Array.isArray(node.params.color))
                return;

            const key = this.rgbToHex(node.params.color);
            if (seen.has(key))
                return;

            seen.add(key);
            colors.push(node.params.color);
        });

        return colors;
    }

    updateNodeParam(nodeId, key, value, options = {}) {
        this.graph.updateNode(nodeId, { params: { [key]: value } });
        this.applyGraph();
        if (options.rerender !== false)
            this.render();
    }

    createSelect(options, value, onChange = null) {
        const select = document.createElement("select");
        options.forEach(option => {
            const item = typeof option === "string" ? { label: option, value: option } : option;
            const optionElement = document.createElement("option");
            optionElement.value = item.value;
            optionElement.textContent = item.label;
            select.appendChild(optionElement);
        });
        select.value = value;
        if (onChange)
            select.addEventListener("change", () => onChange(select.value));
        return select;
    }

    getInstrumentOptions(currentInstrument) {
        const options = Object.keys(INSTRUMENTS).map(key => ({ label: key, value: key }));
        if (currentInstrument && !INSTRUMENTS[currentInstrument] && !options.some(option => option.value === currentInstrument))
            options.unshift({ label: currentInstrument, value: currentInstrument });

        SOUNDFONT_INSTRUMENTS.forEach(instrument => {
            if (!options.some(option => option.value === instrument))
                options.push({ label: instrument, value: instrument });
        });

        return options;
    }

    rgbToHex(color) {
        return `#${color.map(channel => Math.round(Math.max(0, Math.min(255, Number(channel)))).toString(16).padStart(2, "0")).join("")}`;
    }

    hexToRgb(hex) {
        const value = hex.replace("#", "");
        return [
            parseInt(value.slice(0, 2), 16),
            parseInt(value.slice(2, 4), 16),
            parseInt(value.slice(4, 6), 16),
        ];
    }

    looksLikeMojibake(text) {
        const value = String(text || "");
        const suspicious = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìîïðñòóôõöøùúûüýþÿ¢µ¤«»‚„…†‡ˆ‰‹ŒŽ‘’“”•–—˜™š›œžŸ]/g) || []).length;
        const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
        const kana = (value.match(/[\u3040-\u30ff]/g) || []).length;

        return suspicious >= 2 && cjk + kana === 0;
    }

    injectStyles() {
        if (document.getElementById("midiviz-node-editor-style"))
            return;

        const style = document.createElement("style");
        style.id = "midiviz-node-editor-style";
        style.textContent = `
            .midiviz-node-editor {
                position: fixed;
                inset: 0;
                width: 100vw;
                height: 100vh;
                box-sizing: border-box;
                overflow: auto;
                color: #f7f7f7;
                font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                z-index: 2147483647;
                text-rendering: optimizeLegibility;
                background: rgba(0, 0, 0, 0.76);
                padding: 0;
                padding-top: 86px;
            }
            .midiviz-node-editor.is-hidden {
                display: none;
            }
            .node-editor-controls {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2147483647;
                box-sizing: border-box;
                color: #f7f7f7;
                font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                background: rgba(0, 0, 0, 0.82);
                border-bottom: 1px solid rgba(255, 255, 255, 0.14);
                padding: 8px 12px;
            }
            .node-editor-file-button {
                display: inline-grid;
                place-items: center;
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 6px;
                background: rgba(20, 20, 24, 0.92);
                color: #f7f7f7;
                font: 12px Arial, Helvetica, sans-serif;
                padding: 5px 7px;
                cursor: pointer;
            }
            .node-editor-file-button input {
                display: none;
            }
            .node-editor-toolbar {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }
            .node-editor-playback {
                display: flex;
                gap: 8px;
                align-items: center;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                background: rgba(0, 0, 0, 0.55);
                padding: 8px;
            }
            .node-editor-seek-group {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1 1 auto;
                min-width: 0;
            }
            .node-editor-toolbar button,
            .node-editor-playback button,
            .node-editor-playback input,
            .node-card button,
            .node-card select,
            .node-card input {
                appearance: auto;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                background: rgba(20, 20, 24, 0.9);
                color: #f7f7f7;
                font: 12px Arial, Helvetica, sans-serif;
                padding: 5px 7px;
            }
            .node-editor-playback input[type="range"] {
                flex: 1 1 auto;
                width: auto;
                min-width: 0;
            }
            .node-editor-time {
                color: rgba(255, 255, 255, 0.82);
                font: 12px Menlo, Consolas, monospace;
                white-space: nowrap;
                flex: 0 0 96px;
                text-align: right;
            }
            .node-editor-status {
                min-height: 16px;
                margin-top: 4px;
                color: rgba(255, 255, 255, 0.72);
                font: 11px Arial, Helvetica, sans-serif;
            }
            .node-editor-canvas {
                position: relative;
                min-height: calc(100vh - 86px);
                border: 0;
                border-radius: 0;
                background: rgba(0, 0, 0, 0.62);
                backdrop-filter: blur(6px);
            }
            .node-editor-edges {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }
            .node-edge {
                stroke: rgba(255, 255, 255, 0.5);
                stroke-width: 2;
            }
            .node-edge-group {
                stroke: rgba(69, 202, 255, 0.95);
                stroke-width: 3;
                filter: drop-shadow(0 0 6px rgba(69, 202, 255, 0.45));
            }
            .node-edge-member {
                stroke: rgba(69, 202, 255, 0.45);
                stroke-width: 2;
                stroke-dasharray: 6 5;
                filter: none;
            }
            .node-card {
                position: absolute;
                width: 220px;
                box-sizing: border-box;
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 10px;
                background: rgba(28, 31, 38, 0.94);
                padding: 10px;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
            }
            .node-card-pianoRoll {
                width: 560px;
            }
            .node-card.is-dragging {
                opacity: 0.92;
                user-select: none;
            }
            .node-card h3 {
                margin: 0 0 8px;
                font-size: 14px;
            }
            .node-drag-handle {
                cursor: grab;
                user-select: none;
            }
            .node-drag-handle:active {
                cursor: grabbing;
            }
            .node-meta {
                margin: 3px 0;
                color: rgba(255, 255, 255, 0.68);
                font-size: 12px;
            }
            .node-field {
                display: grid;
                gap: 4px;
                margin-top: 8px;
                font-size: 12px;
            }
            .node-field select,
            .node-field input {
                width: 100%;
                box-sizing: border-box;
            }
            .track-group-members {
                display: grid;
                gap: 5px;
                max-height: 180px;
                overflow: auto;
                margin-top: 8px;
                padding: 6px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.18);
            }
            .node-inline-field {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.82);
            }
            .node-inline-field input {
                width: auto;
            }
            .node-color-palette {
                display: grid;
                gap: 6px;
            }
            .node-color-swatches {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }
            .node-color-swatch {
                width: 22px !important;
                height: 22px;
                min-width: 22px;
                margin: 0 !important;
                padding: 0 !important;
                border-radius: 5px !important;
                border: 1px solid rgba(255, 255, 255, 0.45) !important;
                cursor: pointer;
            }
            .node-card button {
                width: 100%;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

export default NodeEditor;
