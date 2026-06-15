import Collection from "./BaseCollection.js";
import Quad from "../primitives/Quad.js";
import vec2 from "../utils/Vec2.js";
import PianoRoll from "./PianoRoll.js";

//A collection contains a set of quads
class QuadSet extends Collection {

    constructor(trackIdx = 0, speed_scale = 5e-3, listenToAll = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super(trackIdx, speed_scale, listenToAll, colorGenerator);
        this.setOnNotePlayed(this.defaultOnNotePlayed);
    }

    /**
     * @param {vec2} position
     * @param {vec2} acceleration
     * @param {number} sizeX
     * @param {number} sizeY
     * @param {number[]} color
     * @returns {void}
     * @description add a quad to the collection given position, initial direction, size and color
     */
    add(position, acceleration = new vec2(0, -1), sizeX = 12.5, sizeY = 10, color = this.colorGenerator(detail)) {
        this.collection.push(new Quad(position, new vec2(0, 0), acceleration.scalar_mul(this.speed_scale), this.trackIdx, sizeX, sizeY, color));
    }


    /**
     * @description default mapping is given by scaling the pitch as the x position
     */
    defaultOnNotePlayed = (detail) => {
        let pitch = detail.note.midi;
        let duration = detail.note.duration;
        let pos = new vec2(pitch / 127 * 1920, 0);
        this.add(pos, new vec2(0, 1), 12.5, this.getDurationHeight(duration), this.colorGenerator(detail));
    };

    /**
     * @description if there's PianoRoll, the initial position of the quad is exactly at the corresponding
     * piano key.
     */
    defaultOnNotePlayedWithKeys = (detail, keys) => {
        console.assert((keys instanceof PianoRoll), { msg: "Invalid keys type, expected PianoRoll" });

        let pitch = detail.note.midi;
        let duration = detail.note.duration;
        const key = keys.getNoteByPitch(pitch);
        if (!key)
            return;

        const width = this.getUniformKeyWidth(keys);
        const pos = new vec2(key.position.x + (key.sizeX - width) / 2, key.position.y);
        this.add(pos, new vec2(0, -1), width, this.getDurationHeight(duration), this.colorGenerator(detail));
    };

    getUniformKeyWidth(keys) {
        const blackKey = keys.collection.find(key => !key.isWhiteKey);
        return blackKey ? blackKey.sizeX : 12.5;
    }

    getDurationHeight(duration, fps = 60) {
        const frames = Math.max(1, duration * fps);
        const acceleration = Math.abs(this.speed_scale);
        return Math.max(6, acceleration * frames * (frames + 1) / 2);
    }

};

export default QuadSet;