import CompoundCollection from './CompoundCollection.js';
import PianoRoll from './PianoRoll.js';
import ParticleSet from './ParticleSet.js';
import QuadSet from './QuadSet.js';
import LineSet from './LineSet.js';
import Histogram from './Histogram.js';

class PianoRollWithPrimitives extends CompoundCollection {

    darkMode = false;

    /** 
    @description The background color of the visualization
    */

    background = [255, 255, 255];
    onNotePlayed = (detail) => { };
    onNoteEnded = (detail) => { };
    globalNotePlayedListener = null;
    globalNoteEndedListener = null;
    pianoRollVisible = true;

    /** 
    @description Initialize a PianoRoll with primitives, initType stands for the first primitive comes along with the piano roll
    */
    constructor(p5, initType = null, darkMode = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super();
        this.darkMode = darkMode;
        this.pianoRollVisible = true;
        this.collections.push(new PianoRoll(p5, 100, [0, 0, 0], [255, 255, 255], darkMode, colorGenerator));
        if(darkMode)
            this.setBackgroundColor([0,0,0]);
        else
            this.setBackgroundColor([255,255,255]);

        switch (initType) {
            case QuadSet:
                this.collections.push(new QuadSet(0, 5e-3, true));
                break;
            case ParticleSet:
                this.collections.push(new ParticleSet(0, 5e-3, true));
                break;
            case null:
                return;
            default:
                console.log("Invalid initType");
                break;
        }

        let keys = this.collections[0];
        let primitives = this.collections[1];
        //set default callback with keys
        primitives.setOnNotePlayed((detail) => {
            primitives.defaultOnNotePlayedWithKeys(detail, keys);
        });

        this.onNotePlayed = (detail) => {};
        this.onNoteEnded = (detail) => {};
        this.globalNotePlayedListener = null;
        this.globalNoteEndedListener = null;
    }

    setBackgroundColor(color) {
        this.background = color;
    };

    setDarkMode(darkMode) {
        this.darkMode = darkMode;

        //recolor the pianoroll
        if (this.darkMode) {
            this.collections[0].setColor_1([0, 0, 0]);
            this.collections[0].setColor_2([255, 255, 255]);
            this.setBackgroundColor([0, 0, 0]);
        }
        else {
            this.collections[0].setColor_1([255, 255, 255]);
            this.collections[0].setColor_2([0, 0, 0]);
            this.setBackgroundColor([255,255,255]);
        }

        this.collections[0].recolor();
    };

    /** 
    @description Adding a collection, we may rewrite the default onNotePlayed callback
    since the keys info are given in this class
    */
    addCollection(collection) {
        super.addCollection(collection);
        let setsDepdendentOnKeys = [QuadSet, ParticleSet, Histogram];
        if (setsDepdendentOnKeys.includes(collection.constructor)) {
            let keys = this.collections[0];
            collection.setOnNotePlayed((detail) => {
                collection.defaultOnNotePlayedWithKeys(detail, keys);
            });
        }
    };

    /**
     * @description Get the pianoroll collection
    */
    getKeys() {
        return this.collections[0];
    };

    /**
     * @description Get the primitive collections, excluding pianoroll
    */
    getPrimitiveCollections() {
        return this.collections.slice(1);
    }


    setSpeedScale(speed_scale) {
        this.collections.forEach((collection) => {
            collection.setSpeedScale(speed_scale);
        });
    };

    setKeyHeight(height) {
        this.collections[0].setHeight(height);
    }

    setPianoRollVisible(visible) {
        this.pianoRollVisible = visible;
    }

    setKeyColor_1(color) {
        this.collections[0].setColor_1(color);
    }

    setKeyColor_2(color) {
        this.collections[0].setColor_2(color);
    }

    //custom step function, since the draw order might be important
    step(p5) {
        var pianoroll = this.collections[0];
        p5.background(this.background);

        this.getPrimitiveCollections().forEach((collection) => {
            collection.advance();
            collection.checkBoundary(p5);
            collection.draw(p5);
        })

        if (this.pianoRollVisible)
            pianoroll.step(p5);
    }

    /**
     * @description since each primitive collection only cares about its own track, we need method to take care of global variables
        set callback for changing other global variables, only one event listener can be set at a time
     */
    setGlobalOnNotePlayed(callback) {
        if (this.globalNotePlayedListener)
            document.removeEventListener("notePlayed", this.globalNotePlayedListener);

        this.onNotePlayed = callback;
        this.globalNotePlayedListener = (e) => {
            this.onNotePlayed(e.detail);
        };
        document.addEventListener("notePlayed", this.globalNotePlayedListener);
    }

    /**
     @description since each primitive collection only cares about its own track, we need method to take care of global variables
        set callback for changing other global variables, only one event listener can be set at a time
     */
    setGlobalOnNoteEnded(callback) {
        if (this.globalNoteEndedListener)
            document.removeEventListener("noteEnded", this.globalNoteEndedListener);

        this.onNoteEnded = callback;
        this.globalNoteEndedListener = (e) => {
            this.onNoteEnded(e.detail);
        };
        document.addEventListener("noteEnded", this.globalNoteEndedListener);
    }

};

export default PianoRollWithPrimitives;