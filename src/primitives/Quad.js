import vec2 from "../utils/Vec2.js";
import Primitive from "./Primitive.js";

class Quad extends Primitive {
    constructor(position, velocity = new vec2(0, 0), acceleration = new vec2(0, 0), trackIdx = 0, sizeX = 5, sizeY = 5, color = [255, 255, 255]) {
        super();
        this.position = position;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.trackIdx = trackIdx;
        this.color = color;
    }

    draw(p5) {
        p5.fill(this.color);
        p5.rect(this.position.x, this.position.y, this.sizeX, this.sizeY);
    }

        //override the bounary function, the actual draw position is different from the position of the particle
    checkBoundary(p5) {
        if (this.position.x < 0 || this.position.x > p5.windowWidth || this.position.y < -1000 || this.position.y > p5.windowHeight)
            return true;
        return false;
    }
};

export default Quad;