import Collection from "./BaseCollection.js";
import Ripple from "../primitives/Ripple.js";
import vec2 from "../utils/Vec2.js";

class RippleSet extends Collection {
    constructor(trackIdx = 0, speed_scale = 5e-3, listenToAll = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super(trackIdx, speed_scale, listenToAll, colorGenerator);
        this.setOnNotePlayed(this.defaultOnNotePlayed);
    }

    /**
     * @param {vec2} position
     * @param {vec2} acceleration
     * @param {number} sizeAccel
     * @param {number} size
     * @param {number[]} color
     * @returns {void}
     * @description Add a ripple to the set, sizeAccel specifies how fast the ripple grows.
     */
    add(position, acceleration = new vec2(0, 1), sizeAccel = 0.1, size = 10, color = this.colorGenerator(detail)) {
        this.pushPrimitive(new Ripple(position, new vec2(0, 0), acceleration.scalar_mul(this.speed_scale), sizeAccel, size, this.trackIdx, color));
    };

     /**
     * @description the ripple will be randomly generated on the screen whenever a note is being played.
     * It's max size is decided by the duration of the note.
     */
    defaultOnNotePlayed = (detail) => {
        let duration = detail.note.duration
        let pos = new vec2(Math.random() * 1920, Math.random() * 1080);
        this.add(pos, vec2.zeros(), 1, 100 * duration, this.colorGenerator(detail));
    };
};

export default RippleSet;