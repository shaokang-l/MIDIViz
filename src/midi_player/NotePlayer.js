import { Reverb, SplendidGrandPiano, Soundfont } from "https://unpkg.com/smplr/dist/index.mjs"; // needs to be a url
import FileHandler from "./FileHandler.js";
import { INSTRUMENTS, SOUNDFONT_INSTRUMENTS } from "./Instruments.js";

var constraints = { audio: true }

//A MIDI note player
class NotePlayer {
    tracks = [];
    trackSettings = [];

    constructor() {
        this.tracks = [];
        this.trackSettings = [];
        this.currentContext = null;
        this.playbackToken = 0;
    };

    /**
     * @description get min and max pitch of a certain track
     * write result to trackSettings array
     */
    calcMinMaxPitch(idx) {
        let min = 127;
        let max = 0;
        this.tracks[idx].notes.forEach(note => {
            if (note.midi > max) max = note.midi;
            if (note.midi < min) min = note.midi;
        });

        this.trackSettings[idx].minPitch = min;
        this.trackSettings[idx].maxPitch = max;
    }

    /**
 * @description  Get min and max pitch of all tracks.
    Write result to trackSettings array
 */
    calcAllMinMaxPitch() {
        for (let i = 0; i < this.trackSettings.length; i++)
            this.calcMinMaxPitch(i);
    }

    getMinMaxPitch(idx) {
        return { minPitch: this.trackSettings[idx].minPitch, maxPitch: this.trackSettings[idx].maxPitch };
    }

    //set reverb amount of a certain track
    setReverb(r, idx = 0) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.trackSettings.length, { msg: "index out of bound" });
        this.trackSettings[idx].reverb = r;
    }

    setSustain(s, idx = 0) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.trackSettings.length, { msg: "index out of bound" });
        this.trackSettings[idx].sustain = s;
    }

    //Not recommended for wind instruments
    setAllSustain(s) {
        this.trackSettings.forEach(track => {
            track.sustain = s;
        });
    }

    /**
     * @description Get instrument type of a certain track
     */
    getInstrument(idx = 0) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.trackSettings.length, { msg: "index out of bound" });
        //assert instrument is valid
        return this.trackSettings[idx].instrument;
    }

    /**
     * @description Set instrument type of a certain track
     */
    setInstrument(instr, idx = 0) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.trackSettings.length, { msg: "index out of bound" });
        this.trackSettings[idx].instrument = this.resolveInstrumentName(instr);
    }

    /**
     * @description Get track setting of a certain track
     */
    getTrackSetting(idx) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.trackSettings.length, { msg: "index out of bound" });
        return this.trackSettings[idx];
    }

    //shift note pitch
    shiftNotes(shift, idx = 0) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.tracks.length, { msg: "index out of bound" });
        this.trackSettings[idx].shift = shift;
        this.trackSettings[idx].minPitch += shift;
        this.trackSettings[idx].maxPitch += shift;
    };

    //shift note pitch for all tracks
    shiftAllNotes(shift) {
        this.trackSettings.forEach(track => {
            track.shift = shift;
            track.minPitch += shift;
            track.maxPitch += shift;
        });
    }

    //set instrument type for all tracks
    setAllInstruments(instr) {
        console.assert(INSTRUMENTS.hasOwnProperty(instr.toLowerCase()), { msg: "invalid instrument" });
        this.trackSettings.forEach(track => {
            track.instrument = INSTRUMENTS[instr.toLowerCase()];
        });
    }

    //set reverb amount for all tracks
    setAllReverb(r) {
        this.trackSettings.forEach(track => {
            track.reverb = r;
        });
    }


    /**
     * @description Load the midi file, async method since load Midi is async
     */
    async load(url) {
        const handler = new FileHandler();
        await handler.loadMidi(url).then(() => {
            this.tracks = handler.convertAllToCustomNotes();
            this.initializeTrackSettings();
        });

    };

    async loadFile(file) {
        const handler = new FileHandler();
        await handler.loadMidiFile(file);
        this.tracks = handler.convertAllToCustomNotes();
        this.initializeTrackSettings();
    }

    initializeTrackSettings() {
        this.stop();
        this.trackSettings = [];
        this.tracks.forEach(track => {
            const resolvedInstrument = this.resolveInstrumentName(track.instrument);
            track.resolvedInstrument = resolvedInstrument;
            //load the track settings
            //each track has an instrument and reverb settings
            this.trackSettings.push({
                instrument: resolvedInstrument,
                reverb: 0.3,
                sustain: 0,
                shift: 0,
                delay: 0,
                velocityScale: 1,
                minPitch: 127,
                maxPitch: 0,
            });
        });
        this.calcAllMinMaxPitch();
    }

    normalizeInstrumentName(instr) {
        return String(instr || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");
    }

    resolveInstrumentName(instr) {
        const key = this.normalizeInstrumentName(instr);
        if (INSTRUMENTS[key])
            return INSTRUMENTS[key];
        if (SOUNDFONT_INSTRUMENTS.includes(key))
            return key;

        const simpleKey = key.replace(/^acoustic_/, "");
        if (INSTRUMENTS[simpleKey])
            return INSTRUMENTS[simpleKey];

        return "acoustic_grand_piano";
    }

    getDuration() {
        let duration = 0;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                duration = Math.max(duration, note.time + note.duration);
            });
        });
        return duration;
    }

    stop() {
        this.playbackToken++;
        if (!this.currentContext)
            return;

        this.currentContext.close();
        this.currentContext = null;
    }


    /**
     * @description  Play the song (all tracks). By default with piano
     */
    defaultPlay(timeOffset = 0) {
        //Resume Audio Context
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                const context = new AudioContext(); // create the audio context
                const now = context.currentTime;
                const reverb = new Reverb(context);


                //create and load the instrument
                const piano = new SplendidGrandPiano(context, {});
                //play piano note based on the custom note format
                piano.loaded().then(() => {
                    for (let i = 0; i < this.tracks.length; i++) {
                        this.tracks[i].notes.forEach(note => {
                            var playNote = note.midi + this.trackSettings[i].shift;
                            const duration = note.duration + this.trackSettings[i].sustain;
                            piano.start({
                                note: playNote, velocity: note.velocity, duration: duration, time: note.time + now,
                                onStart: () => {
                                    const playedNote = { ...note, midi: playNote, duration: duration };
                                    var e = new CustomEvent("notePlayed", { bubbles: true, detail: { note: playedNote, trackNum: i } });
                                    document.dispatchEvent(e);
                                    window.setTimeout(() => {
                                        var ended = new CustomEvent("noteEnded", { bubbles: true, detail: { note: playedNote, trackNum: i } });
                                        document.dispatchEvent(ended);
                                    }, duration * 1000);
                                }, onEnded: () => {}
                            });
                        });
                    }
                });

            })
    };

    /**
     * @description  Play the song (all tracks) with specified track settings
     */
    async play(timeOffset = 0) {
        this.stop();

        const context = new AudioContext(); // create the audio context
        const now = context.currentTime;
        const reverb = new Reverb(context);
        const playbackToken = this.playbackToken;
        const instrumentCache = new Map();
        this.currentContext = context;

        for (let i = 0; i < this.tracks.length; i++) {
            const trackSetting = this.trackSettings[i];
            const scheduledNotes = [];
            this.tracks[i].notes.forEach(note => {
                const noteStart = note.time + (trackSetting.delay || 0);
                const elapsedNoteTime = Math.max(0, timeOffset - noteStart);
                const duration = note.duration + trackSetting.sustain - elapsedNoteTime;
                if (duration <= 0)
                    return;

                const scheduledTime = Math.max(0, noteStart - timeOffset);
                const velocity = Math.max(0, Math.min(127, note.velocity * (trackSetting.velocityScale || 1)));
                var playNote = note.midi + trackSetting.shift;
                scheduledNotes.push({ note, duration, scheduledTime, velocity, playNote });
            });

            if (scheduledNotes.length === 0)
                continue;

            const instrumentKey = `${trackSetting.instrument}|${trackSetting.reverb}`;
            if (!instrumentCache.has(instrumentKey)) {
                instrumentCache.set(instrumentKey, new Soundfont(context, { instrument: trackSetting.instrument }).load.then(instr => {
                    instr.output.addEffect("reverb", reverb, trackSetting.reverb);
                    return instr;
                }));
            }

            const instr = await instrumentCache.get(instrumentKey);
            if (playbackToken !== this.playbackToken)
                return;

            scheduledNotes.forEach(({ note, duration, scheduledTime, velocity, playNote }) => {
                instr.start({
                    note: playNote, velocity: velocity, duration: duration, time: scheduledTime + now,
                    onStart: () => {
                        const playedNote = { ...note, midi: playNote, duration: duration };
                        var e = new CustomEvent("notePlayed", { bubbles: true, detail: { note: playedNote, trackNum: i, timeOffset: timeOffset } });
                        document.dispatchEvent(e);
                        window.setTimeout(() => {
                            if (playbackToken !== this.playbackToken)
                                return;
                            var ended = new CustomEvent("noteEnded", { bubbles: true, detail: { note: playedNote, trackNum: i, timeOffset: timeOffset } });
                            document.dispatchEvent(ended);
                        }, duration * 1000);
                    }, onEnded: () => {}
                });
            });
        }

    };

};

export default NotePlayer;