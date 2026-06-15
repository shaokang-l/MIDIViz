class FileHandler {
    //Tracks is an array of MidiTrack objects
    //Each MidiTrack object has a name and notes array
    //Each note object has a midi, velocity, times, duration info
    tracks = [];
    constructor() {
        this.tracks = [];
    }

    //use Tone.js to parse MIDI file
    //Tone.js@https://github.com/Tonejs/Midi
    //use by include from cdn <script src="https://unpkg.com/@tonejs/midi"></script>
    //or include from npm import {Midi} from '@tonejs/midi'
    async loadMidi(filePath) {
        const midi = await Midi.fromUrl(filePath);
        this.tracks = [];
        midi.tracks.forEach(track => {
            this.tracks.push(track);
        });
    }

    async loadMidiFile(file) {
        const maxMidiBytes = 50 * 1024 * 1024;
        if (file.size > maxMidiBytes)
            throw new Error(`MIDI file is too large (${this.formatBytes(file.size)}). Try exporting a smaller MIDI, or remove unused tracks/controllers first.`);

        let buffer;
        try {
            buffer = await file.arrayBuffer();
        }
        catch (error) {
            throw new Error(`Could not allocate memory for ${file.name}. The file may be too large or the browser is low on memory.`);
        }

        let midi;
        try {
            midi = new Midi(buffer);
        }
        catch (error) {
            if (this.isAllocationError(error))
                throw new Error(`Could not parse ${file.name}: browser memory allocation failed. Try closing other tabs or exporting a smaller MIDI.`);

            const url = URL.createObjectURL(file);
            try {
                midi = await Midi.fromUrl(url);
            }
            finally {
                URL.revokeObjectURL(url);
            }
        }
        this.tracks = [];
        midi.tracks.forEach(track => {
            this.tracks.push(track);
        });
    }

    isAllocationError(error) {
        return /array buffer|allocation|memory/i.test(String(error && (error.message || error)));
    }

    formatBytes(bytes) {
        const units = ["B", "KB", "MB", "GB"];
        let value = Number(bytes) || 0;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    //return the name of the track
    getTrackName(idx) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.tracks.length, { msg: "index out of bound" });
        const track = this.tracks[idx];
        return this.decodeMidiText(track.name || (track.instrument && track.instrument.name) || `Track ${idx}`);
    }

    getTrackInstrument(idx) {
        console.assert(idx >= 0 && idx < this.tracks.length, { msg: "index out of bound" });
        const track = this.tracks[idx];
        return this.decodeMidiText((track.instrument && track.instrument.name) || track.name || "piano");
    }

    //return the notes of the track
    getTrackNotes(idx) {
        //assert idx is valid
        console.assert(idx >= 0 && idx < this.tracks.length, { msg: "index out of bound" });
        return this.tracks[idx].notes;
    }

    //return the number of tracks
    getTrackCount() {
        return this.tracks.length;
    }

    //convert midi notes to custom note format for a single track
    convertToCustomNotes(idx) {
        let customNotes = {
            name: this.getTrackName(idx),
            instrument: this.getTrackInstrument(idx),
            notes: [],
        }

        //midi: 0-127, velocity: 0-127
        //time: seconds, duration: seconds 
        //noteName: e.g.(C4)
        this.getTrackNotes(idx).forEach(note => {
            //convert midi note to p5 note
            //p5 note has midi, velocity, time, duration
            let customNote = { midi: note.midi, velocity: Math.floor(note.velocity * 127), time: note.time, duration: note.duration, noteName: note.name };
            customNotes.notes.push(customNote);
        });

        return customNotes;
    }

    decodeMidiText(text) {
        const value = String(text || "");
        if (!value)
            return value;

        const candidates = [value, ...this.redecodeTextCandidates(value)];
        return candidates
            .map(candidate => ({ value: candidate, score: this.scoreDecodedText(candidate) }))
            .sort((a, b) => b.score - a.score)[0].value;
    }

    redecodeTextCandidates(text) {
        // Some MIDI files store GBK/Shift-JIS/UTF-8 bytes, but parsers expose
        // them as Windows-1252/Latin-1-like mojibake. Rebuild bytes and try common encodings.
        const bytes = [];
        for (const char of text) {
            const code = char.charCodeAt(0);
            const byte = this.windows1252Byte(char);
            if (byte === null && code > 255)
                return [];
            bytes.push(byte === null ? code : byte);
        }

        const encodings = ["utf-8", "gb18030", "big5", "shift_jis"];
        return encodings
            .map(encoding => {
                try {
                    return new TextDecoder(encoding).decode(new Uint8Array(bytes)).trim();
                }
                catch (error) {
                    return "";
                }
            })
            .filter(candidate => candidate && candidate !== text);
    }

    windows1252Byte(char) {
        const code = char.charCodeAt(0);
        if (code <= 255)
            return code;

        const reverseMap = {
            "\u20ac": 0x80,
            "\u201a": 0x82,
            "\u0192": 0x83,
            "\u201e": 0x84,
            "\u2026": 0x85,
            "\u2020": 0x86,
            "\u2021": 0x87,
            "\u02c6": 0x88,
            "\u2030": 0x89,
            "\u0160": 0x8a,
            "\u2039": 0x8b,
            "\u0152": 0x8c,
            "\u017d": 0x8e,
            "\u2018": 0x91,
            "\u2019": 0x92,
            "\u201c": 0x93,
            "\u201d": 0x94,
            "\u2022": 0x95,
            "\u2013": 0x96,
            "\u2014": 0x97,
            "\u02dc": 0x98,
            "\u2122": 0x99,
            "\u0161": 0x9a,
            "\u203a": 0x9b,
            "\u0153": 0x9c,
            "\u017e": 0x9e,
            "\u0178": 0x9f,
        };

        return reverseMap[char] === undefined ? null : reverseMap[char];
    }

    scoreDecodedText(text) {
        const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
        const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
        const replacement = (text.match(/\uFFFD/g) || []).length;
        const controls = (text.match(/[\u0000-\u001f\u007f-\u009f]/g) || []).length;
        const mojibake = (text.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ¢µ]/g) || []).length;
        const asciiLetters = (text.match(/[A-Za-z]/g) || []).length;

        return cjk * 8 + kana * 6 + asciiLetters - mojibake * 4 - replacement * 20 - controls * 20;
    }

    //convert midi notes to custom note format for all tracks
    convertAllToCustomNotes() {
        let customNotes = [];

        for (let i = 0; i < this.getTrackCount(); i++) {
            const track = this.convertToCustomNotes(i);
            if (track.notes.length > 0)
                customNotes.push(track);
        }

        return customNotes;
    }
}

export default FileHandler;
