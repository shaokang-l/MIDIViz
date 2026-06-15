import CircularParticleSet from "../collections/CircularParticleSet.js";
import Histogram from "../collections/Histogram.js";
import LineSet from "../collections/LineSet.js";
import ParticleSet from "../collections/ParticleSet.js";
import QuadSet from "../collections/QuadSet.js";
import RippleSet from "../collections/RippleSet.js";
import { INSTRUMENTS, SOUNDFONT_INSTRUMENTS } from "../midi_player/Instruments.js";
import PatchGraph, { NODE_TYPES } from "./PatchGraph.js";

const PRIMITIVE_TYPES = {
    QuadSet,
    ParticleSet,
    RippleSet,
    LineSet,
    CircularParticleSet,
    Histogram,
};

class RuntimeController {
    constructor({ player, viz, graph = null }) {
        this.player = player;
        this.viz = viz;
        this.graph = graph || new PatchGraph();
        this.generatedCollections = [];
    }

    setGraph(graphOrData) {
        this.graph = graphOrData instanceof PatchGraph ? graphOrData : new PatchGraph(graphOrData);
        return this.graph;
    }

    createGraphFromPlayer(options = {}) {
        this.graph = PatchGraph.fromTracks(this.player.tracks, options);
        return this.graph;
    }

    applyGraph(options = {}) {
        const applyAudio = options.audio !== false;
        const applyVisualization = options.visualization !== false && options.viz !== false;

        if (applyAudio)
            this.applyAudioGraph();
        this.applyPianoRollGraph();
        if (applyVisualization)
            this.applyVisualizationGraph();
    }

    applyAudioGraph() {
        this.graph.getNodesByType(NODE_TYPES.INSTRUMENT).forEach(instrumentNode => {
            const trackNode = this.graph.findFirstUpstreamNode(instrumentNode.id, NODE_TYPES.TRACK);
            if (!trackNode)
                return;

            this.setTrackInstrument(trackNode.params.trackIndex, instrumentNode.params.instrument);
            this.applyTrackSettings(trackNode.params.trackIndex, instrumentNode.params);
        });
    }

    applyTrackSettings(trackIndex, params = {}) {
        if (trackIndex === undefined || trackIndex < 0 || trackIndex >= this.player.trackSettings.length)
            return;

        const settings = this.player.trackSettings[trackIndex];
        if (params.reverb !== undefined)
            settings.reverb = Number(params.reverb);
        if (params.sustain !== undefined)
            settings.sustain = Number(params.sustain);
        if (params.shift !== undefined)
            settings.shift = Number(params.shift);
        if (params.delay !== undefined)
            settings.delay = Number(params.delay);
        if (params.velocityScale !== undefined)
            settings.velocityScale = Number(params.velocityScale);
    }

    applyPianoRollGraph() {
        const pianoRollNode = this.graph.getNodesByType(NODE_TYPES.PIANO_ROLL)[0];
        if (!pianoRollNode || !this.viz.getKeys)
            return;

        const keys = this.viz.getKeys();
        const params = pianoRollNode.params || {};
        if (this.viz.setPianoRollVisible)
            this.viz.setPianoRollVisible(params.enable !== false && params.visible !== false);
        if (params.height !== undefined && this.viz.setKeyHeight)
            this.viz.setKeyHeight(Number(params.height));
        if (Array.isArray(params.whiteKeyColor) && this.viz.setKeyColor_1)
            this.viz.setKeyColor_1(params.whiteKeyColor);
        if (Array.isArray(params.blackKeyColor) && this.viz.setKeyColor_2)
            this.viz.setKeyColor_2(params.blackKeyColor);
        if (keys.setColorGenerator) {
            if (params.highlightMode === "track")
                keys.setColorGenerator((detail) => this.getColorForTrack(detail.trackNum, params.highlightColor));
            else if (Array.isArray(params.highlightColor))
                keys.setColorGenerator(() => params.highlightColor);
        }

        keys.recolor();
    }

    applyVisualizationGraph() {
        this.disposeGeneratedCollections();

        const keys = this.viz.getKeys ? this.viz.getKeys() : this.viz.collections[0];
        this.viz.collections = [keys];

        this.graph.getNodesByType(NODE_TYPES.PRIMITIVE).forEach(primitiveNode => {
            const collection = this.createCollectionFromNode(primitiveNode);
            if (!collection)
                return;

            this.generatedCollections.push(collection);
            this.viz.addCollection(collection);
        });
    }

    disposeGeneratedCollections() {
        this.generatedCollections.forEach(collection => {
            if (collection.disposeEventListeners)
                collection.disposeEventListeners();
        });
        this.generatedCollections = [];
    }

    createCollectionFromNode(primitiveNode) {
        const primitiveType = primitiveNode.params.primitiveType || primitiveNode.label;
        const CollectionType = PRIMITIVE_TYPES[primitiveType];
        if (!CollectionType)
            return null;

        const groupNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.TRACK_GROUP);
        const trackNode = groupNode ? null : this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.TRACK);
        const motionNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.MOTION);
        const groupTrackIndices = groupNode ? groupNode.params.trackIndices || [] : null;
        const trackIndex = primitiveNode.params.listenToAll ? 0 : (groupTrackIndices ? groupTrackIndices[0] || 0 : (trackNode ? trackNode.params.trackIndex : primitiveNode.params.trackIndex || 0));
        const speedScale = motionNode ? motionNode.params.speedScale : primitiveNode.params.speedScale;
        const listenToAll = primitiveNode.params.listenToAll || false;
        const colorGenerator = this.createColorGenerator(primitiveNode);
        const maxItems = primitiveNode.params.maxItems || this.getDefaultMaxItems(primitiveType);
        const configureCollection = (collection) => {
            if (groupTrackIndices && collection.setTrackIndices)
                collection.setTrackIndices(groupTrackIndices);
            if (collection.setMaxItems)
                collection.setMaxItems(maxItems);
            return collection;
        };

        switch (primitiveType) {
            case "CircularParticleSet":
                return configureCollection(new CircularParticleSet(primitiveNode.params.radius || 150, trackIndex, speedScale || 5e-3, listenToAll, colorGenerator));
            case "Histogram":
                return configureCollection(new Histogram(this.viz.getKeys(), trackIndex, speedScale || 5e-3, listenToAll, colorGenerator));
            default:
                return configureCollection(new CollectionType(trackIndex, speedScale || 5e-3, listenToAll, colorGenerator));
        }
    }

    getDefaultMaxItems(primitiveType) {
        if (primitiveType === "ParticleSet" || primitiveType === "CircularParticleSet")
            return 2000;
        if (primitiveType === "RippleSet")
            return 600;
        if (primitiveType === "LineSet")
            return 800;
        return 4000;
    }

    createColorGenerator(primitiveNode) {
        const colorNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.COLOR);
        const color = primitiveNode.params.color || (colorNode ? colorNode.params.color : null);

        if (Array.isArray(color))
            return () => color;

        return (detail) => {
            const base = detail.trackNum * 53;
            return [
                (base + 69) % 255,
                (base + 202) % 255,
                (base + 255) % 255,
            ];
        };
    }

    getColorForTrack(trackIndex, fallback = [69, 202, 255]) {
        const trackNode = this.graph.getNodesByType(NODE_TYPES.TRACK)
            .find(node => node.params && node.params.trackIndex === trackIndex);
        if (!trackNode)
            return fallback;

        const instrumentNodes = this.graph.getConnectionsFrom(trackNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .filter(node => node && node.type === NODE_TYPES.INSTRUMENT);

        for (const instrumentNode of instrumentNodes) {
            const primitiveNodes = this.graph.getConnectionsFrom(instrumentNode.id)
                .map(connection => this.graph.getNode(connection.to.nodeId))
                .filter(node => node && node.type === NODE_TYPES.PRIMITIVE);

            for (const primitiveNode of primitiveNodes) {
                if (Array.isArray(primitiveNode.params.color))
                    return primitiveNode.params.color;

                const colorNode = this.graph.findFirstUpstreamNode(primitiveNode.id, NODE_TYPES.COLOR);
                if (colorNode && Array.isArray(colorNode.params.color))
                    return colorNode.params.color;
            }
        }

        return fallback;
    }

    setTrackInstrument(trackIndex, instrument) {
        if (trackIndex === undefined || trackIndex < 0 || trackIndex >= this.player.trackSettings.length)
            return;

        if (this.player.resolveInstrumentName) {
            this.player.trackSettings[trackIndex].instrument = this.player.resolveInstrumentName(instrument);
            return;
        }

        if (INSTRUMENTS[instrument]) {
            this.player.setInstrument(instrument, trackIndex);
            return;
        }

        if (SOUNDFONT_INSTRUMENTS.includes(instrument))
            this.player.trackSettings[trackIndex].instrument = instrument;
        else
            this.player.trackSettings[trackIndex].instrument = "acoustic_grand_piano";
    }

    updateTrackInstrument(trackNodeId, instrument) {
        const trackNode = this.graph.getNode(trackNodeId);
        if (!trackNode)
            return;

        const instrumentNode = this.getOrCreateInstrumentForTrack(trackNode);
        this.graph.updateNode(instrumentNode.id, {
            label: instrument,
            params: { ...instrumentNode.params, instrument },
        });
        this.setTrackInstrument(trackNode.params.trackIndex, instrument);
    }

    addPrimitiveForTrack(trackNodeId, primitiveType, params = {}) {
        const trackNode = this.graph.getNode(trackNodeId);
        if (!trackNode)
            return null;

        const siblingCount = this.graph.getConnectionsFrom(this.getOrCreateInstrumentForTrack(trackNode).id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .filter(node => node && node.type === NODE_TYPES.PRIMITIVE)
            .length;
        const primitiveNode = this.graph.addNode({
            type: NODE_TYPES.PRIMITIVE,
            label: primitiveType,
            position: {
                x: 560 + siblingCount * 260,
                y: trackNode.position.y,
            },
            params: {
                primitiveType,
                speedScale: 5e-2,
                listenToAll: false,
                maxItems: this.getDefaultMaxItems(primitiveType),
                ...params,
            },
        });

        const instrumentNode = this.getOrCreateInstrumentForTrack(trackNode);
        this.graph.connect(instrumentNode.id, primitiveNode.id, { fromPort: "audio", toPort: "viz" });
        this.applyVisualizationGraph();
        return primitiveNode;
    }

    addPrimitiveForTrackGroup(groupNodeId, primitiveType, params = {}) {
        const groupNode = this.graph.getNode(groupNodeId);
        if (!groupNode)
            return null;

        const siblingCount = this.graph.getConnectionsFrom(groupNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .filter(node => node && node.type === NODE_TYPES.PRIMITIVE)
            .length;
        const primitiveNode = this.graph.addNode({
            type: NODE_TYPES.PRIMITIVE,
            label: primitiveType,
            position: {
                x: 560 + siblingCount * 260,
                y: groupNode.position.y,
            },
            params: {
                primitiveType,
                speedScale: 5e-2,
                listenToAll: false,
                maxItems: this.getDefaultMaxItems(primitiveType),
                ...params,
            },
        });

        this.graph.connect(groupNode.id, primitiveNode.id, { fromPort: "group", toPort: "viz" });
        this.applyVisualizationGraph();
        return primitiveNode;
    }

    removePrimitive(primitiveNodeId) {
        this.graph.removeNode(primitiveNodeId);
        this.applyVisualizationGraph();
    }

    getOrCreateInstrumentForTrack(trackNode) {
        const existing = this.graph.getConnectionsFrom(trackNode.id)
            .map(connection => this.graph.getNode(connection.to.nodeId))
            .find(node => node && node.type === NODE_TYPES.INSTRUMENT);

        if (existing)
            return existing;

        const instrument = this.player.getInstrument(trackNode.params.trackIndex) || "acoustic_grand_piano";
        const instrumentNode = this.graph.addNode({
            type: NODE_TYPES.INSTRUMENT,
            label: instrument,
            position: {
                x: 264,
                y: trackNode.position.y,
            },
            params: { instrument },
        });
        this.graph.connect(trackNode.id, instrumentNode.id, { fromPort: "midi", toPort: "audio" });
        return instrumentNode;
    }
}

export { PRIMITIVE_TYPES };
export default RuntimeController;
