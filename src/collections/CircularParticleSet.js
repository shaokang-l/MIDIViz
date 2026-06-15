import Collection from "./BaseCollection.js";
import CircularParticle from "../primitives/CircularParticle.js";

class CircularParticleSet extends Collection {
    /** 
    @description The radius(in pixel) of the circle. 
    All particles starts from the edge of the circle
    */
    radius;

    /** 
    @description The size coefficient of each particle, 
    by default the size of particle is sizeCoeff*Math.random()+1
    */
    sizeCoeff;

    /** 
    @description Default callback when a note is being played. 
    Particles' initial position is decided by (midi / 127 *360)
    which is the degree on the circle
    */
    defaultOnNotePlayed = (detail) => {
        let deg = detail.note.midi / 127 * 360;
        for (let i = 0; i < 10; i++)
            this.add(deg, Math.random() * this.sizeCoeff + 1, this.colorGenerator(detail));
    };

    /** 
    @description Default callback when a note is being played, with min max pitch info given.
    Particles' initial position is mapped to (0, 360) degrees. Making sure the visualization is not skewed
    due to unused MIDI pitch.
    */
    defaultOnNotePlayedWithMinMax(detail, minPitch, maxPitch) {
        let pitch = detail.note.midi;
        //map the pitch to a degree in 0 to 360
        let deg = (pitch - minPitch) / (maxPitch - minPitch) * 360;
        for (let i = 0; i < 10; i++)
            this.add(deg, Math.random() * this.sizeCoeff + 1, this.colorGenerator(detail));
    };

    constructor(radius = 100, trackIdx = 0, speed_scale = 5e-3, listenToAll = true, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        super(trackIdx, speed_scale, listenToAll, colorGenerator);
        this.radius = radius;
        this.setOnNotePlayed(this.defaultOnNotePlayed);
        this.sizeCoeff = 15;
    }

    setRadius(radius) {
        this.radius = radius;
    }

    setSize(size) {
        this.sizeCoeff = size;
    }

    add(deg, size = 20, color = [255, 255, 255]) {
        this.pushPrimitive(new CircularParticle(this.radius, deg, this.speed_scale, this.trackIdx, size, color));
    }

}

export default CircularParticleSet;