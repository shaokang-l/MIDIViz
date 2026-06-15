const NODE_TYPES = {
    TRACK: "track",
    TRACK_GROUP: "trackGroup",
    INSTRUMENT: "instrument",
    PRIMITIVE: "primitive",
    COLOR: "color",
    MOTION: "motion",
    PIANO_ROLL: "pianoRoll",
};

const CONNECTION_PORTS = {
    MIDI: "midi",
    AUDIO: "audio",
    VIZ: "viz",
    COLOR: "color",
    MOTION: "motion",
};

class PatchGraph {
    constructor(data = {}) {
        this.nodes = [];
        this.connections = [];
        this.nextId = 1;

        if (data.nodes || data.connections)
            this.load(data);
    }

    static fromTracks(tracks, options = {}) {
        const graph = new PatchGraph();
        const defaultInstrument = options.defaultInstrument || null;
        const defaultPrimitive = options.defaultPrimitive || "QuadSet";
        const defaultColor = options.defaultColor || [69, 202, 255];
        const rowHeight = options.rowHeight || 440;
        const startY = options.startY || 32;
        const columns = options.columns || {
            track: 24,
            instrument: 300,
            group: 300,
            primitive: 600,
            pianoRoll: 24,
        };

        const pianoRollNode = graph.addNode({
            type: NODE_TYPES.PIANO_ROLL,
            label: "Piano Roll",
            position: { x: columns.pianoRoll, y: startY },
            params: {
                enable: true,
                height: 100,
                whiteKeyColor: [255, 255, 255],
                blackKeyColor: [0, 0, 0],
                highlightColor: defaultColor,
                highlightMode: "track",
            },
        });

        tracks.forEach((track, trackIndex) => {
            if (!track.notes || track.notes.length === 0)
                return;

            const y = startY + 420 + trackIndex * rowHeight;
            const trackLabel = PatchGraph.getTrackDisplayName(track, trackIndex);
            const instrument = defaultInstrument || track.resolvedInstrument || "acoustic_grand_piano";
            const trackNode = graph.addNode({
                type: NODE_TYPES.TRACK,
                label: trackLabel,
                position: { x: columns.track, y },
                params: {
                    trackIndex,
                    noteCount: track.notes ? track.notes.length : 0,
                    rawName: track.name || "",
                    rawInstrument: track.instrument || "",
                    displayName: trackLabel,
                    resolvedInstrument: instrument,
                },
            });

            const instrumentNode = graph.addNode({
                type: NODE_TYPES.INSTRUMENT,
                label: instrument,
                position: { x: columns.instrument, y },
                params: {
                    instrument: instrument,
                    delay: 0,
                    sustain: 0,
                    reverb: 0.3,
                    shift: 0,
                    velocityScale: 1,
                },
            });

            graph.connect(trackNode.id, instrumentNode.id, {
                fromPort: CONNECTION_PORTS.MIDI,
                toPort: CONNECTION_PORTS.AUDIO,
            });

            const primitiveNode = graph.addNode({
                type: NODE_TYPES.PRIMITIVE,
                label: defaultPrimitive,
                position: { x: columns.primitive, y },
                params: {
                    primitiveType: defaultPrimitive,
                    speedScale: 5e-2,
                    listenToAll: false,
                    maxItems: 4000,
                    color: defaultColor,
                },
            });

            graph.connect(instrumentNode.id, primitiveNode.id, {
                fromPort: CONNECTION_PORTS.AUDIO,
                toPort: CONNECTION_PORTS.VIZ,
            });
        });

        return graph;
    }

    addTrackGroup(trackIndices = [], options = {}) {
        const index = this.getNodesByType(NODE_TYPES.TRACK_GROUP).length;
        const node = this.addNode({
            type: NODE_TYPES.TRACK_GROUP,
            label: options.label || `Track Group ${index + 1}`,
            position: options.position || { x: 300, y: 220 + index * 220 },
            params: {
                trackIndices: [...trackIndices],
            },
        });

        this.getNodesByType(NODE_TYPES.TRACK)
            .filter(trackNode => trackIndices.includes(trackNode.params.trackIndex))
            .forEach(trackNode => {
                this.connect(trackNode.id, node.id, { fromPort: CONNECTION_PORTS.MIDI, toPort: "member" });
            });

        return node;
    }

    static getTrackDisplayName(track, trackIndex) {
        const name = PatchGraph.cleanDisplayText(track.name);
        const rawInstrument = PatchGraph.cleanDisplayText(track.instrument);
        const fallback = `Track ${trackIndex}`;
        const isGenericTrackName = !name || /^track\s*\d+$/i.test(name);

        if (isGenericTrackName && rawInstrument)
            return rawInstrument;
        if (name)
            return name;
        return fallback;
    }

    static cleanDisplayText(text) {
        const value = String(text || "").trim();
        if (!value || PatchGraph.looksLikeMojibake(value))
            return "";

        return value;
    }

    static looksLikeMojibake(text) {
        const suspicious = (text.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ¢µ¤«»‚„…†‡ˆ‰‹ŒŽ‘’“”•–—˜™š›œžŸ]/g) || []).length;
        const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
        const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;

        return suspicious >= 2 && cjk + kana === 0;
    }

    load(data) {
        this.nodes = (data.nodes || []).map(node => this.cloneNode(node));
        this.connections = (data.connections || []).map(connection => this.cloneConnection(connection));
        this.nextId = this.calculateNextId();
    }

    serialize() {
        return {
            version: 1,
            nodes: this.nodes.map(node => this.cloneNode(node)),
            connections: this.connections.map(connection => this.cloneConnection(connection)),
        };
    }

    autoLayout(options = {}) {
        const rowHeight = options.rowHeight || 440;
        const startY = options.startY || 32;
        const trackStartY = options.trackStartY || startY + 420;
        const columns = options.columns || {
            track: 24,
            instrument: 300,
            group: 300,
            primitive: 600,
            color: 880,
            pianoRoll: 24,
        };

        const pianoRollNodes = this.getNodesByType(NODE_TYPES.PIANO_ROLL);
        pianoRollNodes.forEach((node, index) => {
            node.position = { x: columns.pianoRoll, y: startY + index * 300 };
        });

        this.getNodesByType(NODE_TYPES.TRACK).forEach((trackNode, rowIndex) => {
            const y = trackStartY + rowIndex * rowHeight;
            trackNode.position = { x: columns.track, y };

            this.getConnectionsFrom(trackNode.id)
                .map(connection => this.getNode(connection.to.nodeId))
                .filter(node => node && node.type === NODE_TYPES.INSTRUMENT)
                .forEach(instrumentNode => {
                    instrumentNode.position = { x: columns.instrument, y };

                    const primitiveNodes = this.getConnectionsFrom(instrumentNode.id)
                        .map(connection => this.getNode(connection.to.nodeId))
                        .filter(node => node && node.type === NODE_TYPES.PRIMITIVE);

                    primitiveNodes.forEach((primitiveNode, primitiveIndex) => {
                        primitiveNode.position = { x: columns.primitive + primitiveIndex * 280, y };

                        this.getConnectionsTo(primitiveNode.id, CONNECTION_PORTS.COLOR)
                            .map(connection => this.getNode(connection.from.nodeId))
                            .filter(node => node && node.type === NODE_TYPES.COLOR)
                            .forEach(colorNode => {
                                colorNode.position = { x: columns.color + primitiveIndex * 280, y };
                            });
                    });
                });
        });

        this.getNodesByType(NODE_TYPES.TRACK_GROUP).forEach((groupNode, groupIndex) => {
            const trackIndices = groupNode.params.trackIndices || [];
            const minTrackIndex = trackIndices.length > 0 ? Math.min(...trackIndices) : groupIndex;
            groupNode.position = { x: columns.group, y: trackStartY + minTrackIndex * rowHeight + 180 };

            this.getConnectionsFrom(groupNode.id)
                .map(connection => this.getNode(connection.to.nodeId))
                .filter(node => node && node.type === NODE_TYPES.PRIMITIVE)
                .forEach((primitiveNode, primitiveIndex) => {
                    primitiveNode.position = { x: columns.primitive + primitiveIndex * 280, y: groupNode.position.y };
                });
        });

        return this;
    }

    addNode({ type, label = "", position = { x: 0, y: 0 }, params = {} }) {
        const node = {
            id: this.createId(type),
            type,
            label,
            position: { ...position },
            params: { ...params },
        };
        this.nodes.push(node);
        return node;
    }

    updateNode(nodeId, updates = {}) {
        const node = this.getNode(nodeId);
        if (!node)
            return null;

        if (updates.label !== undefined)
            node.label = updates.label;
        if (updates.position)
            node.position = { ...node.position, ...updates.position };
        if (updates.params)
            node.params = { ...node.params, ...updates.params };

        return node;
    }

    removeNode(nodeId) {
        this.nodes = this.nodes.filter(node => node.id !== nodeId);
        this.connections = this.connections.filter(connection => connection.from.nodeId !== nodeId && connection.to.nodeId !== nodeId);
    }

    connect(fromNodeId, toNodeId, options = {}) {
        const connection = {
            id: this.createId("connection"),
            from: {
                nodeId: fromNodeId,
                port: options.fromPort || "out",
            },
            to: {
                nodeId: toNodeId,
                port: options.toPort || "in",
            },
        };
        this.connections.push(connection);
        return connection;
    }

    disconnect(connectionId) {
        this.connections = this.connections.filter(connection => connection.id !== connectionId);
    }

    replaceIncoming(toNodeId, fromNodeId, options = {}) {
        const toPort = options.toPort || "in";
        this.connections = this.connections.filter(connection => !(connection.to.nodeId === toNodeId && connection.to.port === toPort));
        return this.connect(fromNodeId, toNodeId, options);
    }

    getNode(nodeId) {
        return this.nodes.find(node => node.id === nodeId);
    }

    getNodesByType(type) {
        return this.nodes.filter(node => node.type === type);
    }

    getConnectionsFrom(nodeId) {
        return this.connections.filter(connection => connection.from.nodeId === nodeId);
    }

    getConnectionsTo(nodeId, port = null) {
        return this.connections.filter(connection => connection.to.nodeId === nodeId && (port === null || connection.to.port === port));
    }

    getUpstreamNodes(nodeId, port = null) {
        return this.getConnectionsTo(nodeId, port)
            .map(connection => this.getNode(connection.from.nodeId))
            .filter(node => node);
    }

    findFirstUpstreamNode(nodeId, type, visited = new Set()) {
        if (visited.has(nodeId))
            return null;

        visited.add(nodeId);
        const upstream = this.getUpstreamNodes(nodeId);
        const direct = upstream.find(node => node.type === type);
        if (direct)
            return direct;

        for (const node of upstream) {
            const found = this.findFirstUpstreamNode(node.id, type, visited);
            if (found)
                return found;
        }

        return null;
    }

    clone() {
        return new PatchGraph(this.serialize());
    }

    createId(prefix) {
        return `${prefix}-${this.nextId++}`;
    }

    calculateNextId() {
        const ids = [...this.nodes.map(node => node.id), ...this.connections.map(connection => connection.id)];
        const maxId = ids.reduce((max, id) => {
            const numericId = Number(String(id).split("-").pop());
            return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
        }, 0);

        return maxId + 1;
    }

    cloneNode(node) {
        return {
            id: node.id,
            type: node.type,
            label: node.label || "",
            position: { ...(node.position || { x: 0, y: 0 }) },
            params: { ...(node.params || {}) },
        };
    }

    cloneConnection(connection) {
        return {
            id: connection.id,
            from: { ...connection.from },
            to: { ...connection.to },
        };
    }
}

export { CONNECTION_PORTS, NODE_TYPES };
export default PatchGraph;
