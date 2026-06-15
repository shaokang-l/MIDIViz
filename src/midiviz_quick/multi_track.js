import CircularParticleSet from "../collections/CircularParticleSet.js";
import LineSet from "../collections/LineSet.js";
import ParticleSet from "../collections/ParticleSet.js";
import PianoRollWithPrimitives from "../collections/PianoRollWithPrimitives.js";
import QuadSet from "../collections/QuadSet.js";
import RippleSet from "../collections/RippleSet.js";
import NotePlayer from "../midi_player/NotePlayer.js";
import vec2 from "../utils/Vec2.js";
import Histogram from "../collections/Histogram.js";

//This example provides a multitrack, multi-primitive visualizer
//Each track is represented by a different color
//You can bind different primitives to different tracks
new p5(function (p5) {
    const viz = new PianoRollWithPrimitives(p5, null, true);
    const player = new NotePlayer();

    //set up the play settings and particle speed
    p5.setup = async function () {
        p5.createCanvas(p5.windowWidth, p5.windowHeight);
        const url = "../../assets/itohakanashi.mid"
        await player.load(url);
        //set play settings
        player.setAllSustain(0.6);
        player.setSustain(0, 6);
        player.setAllReverb(0.5);

        //set instrument type
        player.setInstrument("piano", 0);
        player.setInstrument("piano", 1);
        player.setInstrument("xylophone", 2);
        player.setInstrument("xylophone", 5);
        player.setInstrument("flute", 6);
        await player.play();

        //set global visualization unit moving speed
        //speed scale (use whole number instead)
        viz.setSpeedScale(5e-2);

        //add primitives, and they listen to different tracks
        viz.addCollection(new QuadSet(0, 5e-2, false, (detail) => { return [69, 202, 255] }));
        viz.addCollection(new RippleSet(0, 5e-2, false, (detail) => { return [69, 202, 255] }));

        viz.addCollection(new QuadSet(1, 5e-2, false, (detail) => { return [69, 202, 255] }));

        viz.addCollection(new QuadSet(2, 8e-2, false, (detail) => { return [255, 147, 15] }));
        viz.addCollection(new ParticleSet(5, 8e-2, false, (detail) => { return [255, 147, 15] }));

        viz.addCollection(new QuadSet(3, 5e-2, false, (detail) => { return [69, 202, 255] }));
        viz.addCollection(new QuadSet(4, 5e-2, false, (detail) => { return [69, 202, 255] }));

        viz.addCollection(new CircularParticleSet(150, 6 , 5e-3, false, (detail) => { return [255, 27, 107] }));


        //piano color settings, each track has a different color
        viz.setColorGenerator(0, (detail) => {
            switch(player.getInstrument(detail.trackNum))
            {   
                case "acoustic_grand_piano":
                    return [69, 202, 255];
                case "xylophone":
                    return [255, 147, 15];
                default:
                    return [255, 27, 107];
            }

        });


    }

    //called on each frame, the draw call loop
    p5.draw = function () {
        viz.step(p5);
    }
});