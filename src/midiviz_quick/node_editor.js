import NodeEditor from "../gui/NodeEditor.js";
import PianoRollWithPrimitives from "../collections/PianoRollWithPrimitives.js";
import NotePlayer from "../midi_player/NotePlayer.js";
import RuntimeController from "../runtime/RuntimeController.js";

new p5(function (p5) {
    const viz = new PianoRollWithPrimitives(p5, null, true);
    const player = new NotePlayer();
    let controller;
    let canvasElement;
    let playbackOffset = 0;
    let playbackStartedAt = 0;
    let isPlaying = false;
    let recorder = null;
    let recordedChunks = [];

    p5.setup = async function () {
        canvasElement = p5.createCanvas(p5.windowWidth, p5.windowHeight).elt;

        const url = "../../assets/alleycat.mid";
        await player.load(url);
        player.setAllSustain(0.6);
        player.setAllReverb(0.5);

        controller = new RuntimeController({ player, viz });
        const graph = controller.createGraphFromPlayer({
            defaultPrimitive: "QuadSet",
            defaultColor: [69, 202, 255],
        });
        graph.autoLayout();
        controller.applyGraph();

        new NodeEditor({
            graph,
            controller,
            mount: document.body,
            onPlay: playFrom,
            onStop: stopPlayback,
            onSeek: seekTo,
            onRecordStart: startRecording,
            onRecordStop: stopRecording,
            onLoadMidiFile: loadMidiFile,
            getDuration,
            getCurrentTime: getCurrentPlaybackTime,
        });
    };

    p5.draw = function () {
        if (controller)
            viz.step(p5);
    };

    p5.windowResized = function () {
        p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
    };

    async function playFrom(seconds = 0) {
        playbackOffset = Math.max(0, Math.min(getDuration(), seconds));
        playbackStartedAt = performance.now();
        isPlaying = true;

        await player.play(playbackOffset);
    }

    async function seekTo(seconds = 0) {
        playbackOffset = Math.max(0, Math.min(getDuration(), seconds));
        playbackStartedAt = performance.now();

        if (isPlaying)
            await player.play(playbackOffset);
    }

    function stopPlayback() {
        playbackOffset = getCurrentPlaybackTime();
        isPlaying = false;
        player.stop();
    }

    async function loadMidiFile(file, editor) {
        stopPlayback();
        playbackOffset = 0;
        playbackStartedAt = 0;
        isPlaying = false;

        if (typeof player.loadFile === "function") {
            await player.loadFile(file);
        }
        else {
            const url = URL.createObjectURL(file);
            try {
                await player.load(url);
            }
            finally {
                URL.revokeObjectURL(url);
            }
        }
        const graph = controller.createGraphFromPlayer({
            defaultPrimitive: "QuadSet",
            defaultColor: [69, 202, 255],
        });
        graph.autoLayout();
        controller.applyGraph();
        editor.setGraph(graph);
        const graphTrackCount = graph.getNodesByType("track").length;
        return `Loaded ${file.name}: ${graphTrackCount} note tracks (${player.tracks.length} parser tracks)`;
    }

    function getCurrentPlaybackTime() {
        if (!isPlaying)
            return playbackOffset;

        const current = playbackOffset + (performance.now() - playbackStartedAt) / 1000;
        return Math.min(getDuration(), current);
    }

    function getDuration() {
        if (typeof player.getDuration === "function")
            return player.getDuration();

        let duration = 0;
        player.tracks.forEach(track => {
            track.notes.forEach(note => {
                duration = Math.max(duration, note.time + note.duration);
            });
        });
        return duration;
    }

    async function startRecording() {
        if (!canvasElement.captureStream || typeof MediaRecorder === "undefined") {
            window.alert("Canvas recording is not supported in this browser.");
            return false;
        }

        recordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        recorder = new MediaRecorder(canvasElement.captureStream(60), { mimeType });
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0)
                recordedChunks.push(event.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `midiviz-${Date.now()}.webm`;
            link.click();
            URL.revokeObjectURL(url);
        };
        recorder.start();
        return true;
    }

    function stopRecording() {
        if (recorder && recorder.state !== "inactive")
            recorder.stop();
    }
});
