import Collection from "./BaseCollection.js";
import Particle from "../primitives/Particle.js";
import vec2 from "../utils/Vec2.js";
import PianoRoll from "./PianoRoll.js";

class ParticleSet extends Collection {

    constructor(trackIdx = 0, speed_scale = 5e-3, listenToAll = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super(trackIdx, speed_scale, listenToAll, colorGenerator);
        this.setOnNotePlayed(this.defaultOnNotePlayed);
        this.defaultColorGenerator = (detail) => {
            return [255, 255, 255];
        }
    }

    add(position, acceleration = new vec2(0, 1), size = 10, color = [0, 0, 0]) {
        this.collection.push(new Particle(position, new vec2(0, 0), acceleration.scalar_mul(this.speed_scale), size, this.trackIdx, color));
    }

    /**
     * @description The default mapping is give by scaling pitch so that 
     * the initial x position is related to its pitch, the initial y position is 0
     */
    defaultOnNotePlayed = (detail) => {
        let pitch = detail.note.midi;
        let pos = new vec2(pitch / 127 * 1920, 0);
        for (let i = 0; i < 10; i++) {
            this.add(pos, new vec2(0, Math.random()).add(vec2.random2D().scalar_mul(0.05)), 10, this.colorGenerator(detail));
        }
    };

    /**
     * @description The mapping when there's a PianoRoll. The initial position of the quad is exactly at the corresponding
     * piano key.
     */
    defaultOnNotePlayedWithKeys = (detail, keys) => {
        console.assert((keys instanceof PianoRoll), { msg: "Invalid keys type, expected PianoRoll" });

        let pitch = detail.note.midi;
        let pos = keys.getNoteByPitch(pitch).position;
        //generate 10 particles on each note played, the particles are generated at the key position, 
        //with a up vector perturbed by a random vector
        for (let i = 0; i < 10; i++) {
            this.add(pos, new vec2(0, -2*Math.random()).add(vec2.random2D().scalar_mul(0.02)), 10, this.colorGenerator(detail));
        }
    };


};

export default ParticleSet;