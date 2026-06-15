import PianoRollWithPrimitives from "./collections/PianoRollWithPrimitives.js";
import NotePlayer from "./midi_player/NotePlayer.js";
import vec2 from "./utils/Vec2.js";

import QuadSet from "./collections/QuadSet.js";
import ParticleSet from "./collections/ParticleSet.js";
import CircularParticleSet from "./collections/CircularParticleSet.js";


new p5(function (p5) {
    const roll = new PianoRollWithPrimitives(p5, null, true);
    const player = new NotePlayer();

    p5.setup = async function () {
        p5.createCanvas(p5.windowWidth, p5.windowHeight);
        p5.background(255);
        const url = "../assets/anamnesis.mid"
        await player.load(url);
        player.setAllSustain(0.7);
        roll.setSpeedScale(0.1);
        roll.addCollection(new QuadSet(0, 5e-2, false, (detail) => { return [69, 202, 255] }));

        await player.play();
    }

    //called on each frame
    p5.draw = function () {
        roll.step(p5);
    }

});