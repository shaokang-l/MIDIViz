import Quad from "../primitives/Quad.js";
import Collection from "./BaseCollection.js";
import vec2 from "../utils/Vec2.js";

// ----------------------------------------------------------------
// PianoRoll.js
// A piano roll is a collection of keys, each key is a Quad
// with extra pitch, isWhiteKey attributes
// height: height of the piano roll, in pixels
// color_1: color of the white keys
// color_2: color of the black keys
// ----------------------------------------------------------------
class PianoRoll extends Collection {

    /** 
    @description Height of the piano roll, in pixels
    */
    height;
    /** 
    @description First color of the piano roll, (white key)
    */
    color_1;
    /** 
    @description Second color of the piano roll, (black key)
    */
    color_2;

    /** 
    @description The sorted collection of keys, sorted by pitch
    */
    sorted;

    //dark mode
    darkMode;
    activeHighlights;

    constructor(p5, height = 100, color_1 = [255, 255, 255], color_2 = [0, 0, 0], darkMode = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super(0, 0, true, colorGenerator);
        this.p5 = p5;
        this.height = height;
        this.color_1 = color_1;
        this.color_2 = color_2;
        this.activeHighlights = {};
        this.initCollection(p5);
        this.setOnNoteEnded(this.defaultOnNoteEnded);
        this.setOnNotePlayed(this.defaultOnNotePlayed);

        //gives a sorted collection of keys
        let temp = structuredClone(this.collection);
        temp.sort((a, b) => a.pitch - b.pitch);
        this.sorted = temp;
        this.darkMode = darkMode;

        if (this.darkMode) {
            this.setColor_1([0, 0, 0]);
            this.setColor_2([255, 255, 255]);
        }
        else {
            this.setColor_1([255, 255, 255]);
            this.setColor_2([0, 0, 0]);
        }

        this.recolor();
    }

    refreshLayout(p5 = this.p5) {
        if (!p5)
            return;

        this.collection = [];
        this.activeHighlights = {};
        this.initCollection(p5);
        let temp = structuredClone(this.collection);
        temp.sort((a, b) => a.pitch - b.pitch);
        this.sorted = temp;
        this.recolor();
    }

    /** 
    @description The corresponding note will have the color spceified by the colorGenerator
    */
    defaultOnNotePlayed = (detail) => {
        let pitch = detail.note.midi;
        this.activeHighlights[pitch] = this.colorGenerator(detail);
    }

    /** 
    @description The corresponding note returns back to its original color once its ended
    */
    defaultOnNoteEnded = (detail) => {
        let pitch = detail.note.midi;
        const key = this.getNoteByPitch(pitch);
        if (!key)
            return;

        delete this.activeHighlights[pitch];
    };

    //these methods are not allowed
    add() {
        console.error("PianoRoll does not support add()");
    }

    remove() {
        console.error("PianoRoll does not support remove()");
    }

    //disable movement and boundary check
    advance() { }; //do nothing
    checkBoundary() { }; //do nothing

    draw(p5) {
        p5.strokeWeight(1);

        // Draw white keys first, then black keys on top with explicit outlines.
        this.collection.filter(item => item.isWhiteKey).forEach(item => {
            p5.stroke(this.darkMode ? 180 : 35);
            item.draw(p5);
        });

        this.collection.filter(item => !item.isWhiteKey).forEach(item => {
            p5.stroke(this.darkMode ? 235 : 210);
            item.draw(p5);
        });

        p5.noStroke();
        Object.entries(this.activeHighlights).forEach(([pitch, color]) => {
            const key = this.getNoteByPitch(Number(pitch));
            if (!key)
                return;

            const width = this.getUniformHighlightWidth();
            const x = key.position.x + (key.sizeX - width) / 2;
            p5.fill(color);
            p5.rect(x, key.position.y, width, key.sizeY);
        });
    }

    getUniformHighlightWidth() {
        const blackKey = this.collection.find(key => !key.isWhiteKey);
        return blackKey ? blackKey.sizeX : 12.5;
    }

    /** 
    @description Initialize all the keys based on the piano keys' distribution
    */
    initCollection(p5) {
        //draw the piano roll at the bottom of the screen
        const offset = p5.windowHeight - this.height;

        //calculate white keys first, 
        const whiteKeyWidth = p5.windowWidth / 52;
        const blackKeyWidth = whiteKeyWidth / 1.5;
        const whiteKeyHeight = this.height;
        const blackKeyHeight = this.height / 1.6;

        //the first note is C1, which is 24 in MIDI
        let notePitch = 24;
        for (let i = 0; i < 52; i++) {
            //the keys are all static because the speed scale is 0
            const key = new Quad(new vec2(i * whiteKeyWidth, offset), new vec2(0, 0), new vec2(0, 0), 0, whiteKeyWidth, whiteKeyHeight, this.color_1);
            const steps = [2, 2, 1, 2, 2, 2, 1];
            key.pitch = notePitch;
            key.isWhiteKey = true;

            notePitch += steps[i % 7];
            this.collection.push(key);
        }

        //then calculate black keys, these are sharp notes
        const blackKeyIndices = [1, 2, 4, 5, 6];
        const blackKeyIndicesInHalf = [1, 3, 6, 8, 10];

        for (let i = 0; i < 52; i++) {
            if (blackKeyIndices.includes(i % 7)) {
                const key = new Quad(new vec2(i * whiteKeyWidth - blackKeyWidth / 2, offset), new vec2(0, 0), new vec2(0, 0), 0, blackKeyWidth, blackKeyHeight, this.color_2);
                var index = blackKeyIndices.indexOf(i % 7);
                key.pitch = blackKeyIndicesInHalf[index] + 12 * Math.floor(i / 7) + 24;
                key.isWhiteKey = false;

                this.collection.push(key);
            }
        }
    }

    /** 
    @description Get the quad object by pitch
    */
    getNoteByPitch(pitch) {
        return this.collection.find(key => key.pitch === pitch);
    }

    /** 
    @description Get the quad index (sorted by pitch) by pitch
    */
    getSortedNoteIdxByPitch(pitch) {
        return this.sorted.findIndex(key => key.pitch === pitch);
    }

    /** 
    @description Set the note color by pitch
    */
    setNoteColor(pitch, color) {
        const key = this.getNoteByPitch(pitch);
        if (key) {
            key.color = color;
        }
    }

    /** 
    @description Recolor the key to the specified color_1 and color_2
    */
    recolor() {
        this.collection.forEach(key => {
            if (key.isWhiteKey)
                key.color = this.color_1;
            else
                key.color = this.color_2;
        });
    }

    setHeight(height) {
        this.height = height;
        this.refreshLayout();
    }

    setColor_1(color_1) {
        this.color_1 = color_1;
    }

    setColor_2(color_2) {
        this.color_2 = color_2;
    }
};

export default PianoRoll;