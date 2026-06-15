class Collection {
    /** 
    @description Array of primitives
    */
    collection;

    /** 
    @description Current callback of this collection when a note is being played
    */
    onNotePlayed;

    /** 
    @description Current callback of this collection when a note ends playing
    */
    onNoteEnded;

    /** 
    @description If the collection listen to all tracks' events.
    */
    listenToAll;

    /** 
    @description The track index this collection listens to. Each colleciton is associated with one track by default.
    */
    trackIdx;
    trackIndices;
    trackIndexSet;
    maxItems;

    /** 
    @description The initial acceleration of the collection is multiplied by this amount
    */
    speed_scale;

    /**
    @description How the color is determined in the defaultOnNotePlayed callback, takes in note detail, returns the color, int[3]
    */
    colorGenerator;

    notePlayedListener;
    noteEndedListener;

    
    setTrackIdx(trackIdx) {
        this.trackIdx = trackIdx;
        this.trackIndices = null;
        this.trackIndexSet = null;
    }

    setTrackIndices(trackIndices) {
        this.trackIndices = Array.isArray(trackIndices) ? trackIndices : null;
        this.trackIndexSet = this.trackIndices ? new Set(this.trackIndices) : null;
    }

    setSpeedScale(speed_scale) {
        this.speed_scale = speed_scale;
    }

    setListenToAll(listenToAll) {
        this.listenToAll = listenToAll;
    };

    setMaxItems(maxItems) {
        const value = Number(maxItems);
        this.maxItems = Number.isFinite(value) && value > 0 ? Math.floor(value) : Infinity;
        this.pruneOverflow();
    }

    /**
     * @param {number} trackIdx - The track this collection listen to 
     * @param {number} speed_scale - The speed scale for initial acceleration
     * @param {boolean} listenToAll - If this collection reacts to all tracks' event
     * @param {()=> number[]} colorGenerator - The default color pattern for the default onNotePlayed / onNoteEnded callback
     * @returns {void}
     * @description Constructor for a general collection, given track index and speed scale, to extend this class,
     * implement constructor, add function and defaultOnNotePlayed callback.
     */
    constructor(trackIdx = 0, speed_scale = 5e-3, listenToAll = false, colorGenerator = (detail) => { return [Math.random() * 55 + 200, Math.random() * 55 + 200, Math.random() * 55 + 200] }) {
        this.collection = [];
        this.trackIdx = trackIdx;
        this.speed_scale = speed_scale;

        this.onNotePlayed = (detail) => {

        };

        this.onNoteEnded = (detail) => {

        };

        this.listenToAll = listenToAll;
        this.colorGenerator = colorGenerator;
        this.notePlayedListener = null;
        this.noteEndedListener = null;
        this.trackIndices = null;
        this.trackIndexSet = null;
        this.maxItems = Infinity;
    }

    /**
     * @param {Primitive} item - Adding a primitive to the collection
     */
    add(item) {
        this.pushPrimitive(item);
    }

    pushPrimitive(item) {
        this.collection.push(item);
        this.pruneOverflow();
    }

    pruneOverflow() {
        if (!Number.isFinite(this.maxItems))
            return;

        const overflow = this.collection.length - this.maxItems;
        if (overflow > 0)
            this.collection.splice(0, overflow);
    }

    /**
     * @param {number} idx - Remove an item from the collection by index
     */
    remove(idx) {
        this.collection.splice(idx, 1);
    }

    /**
    * @returns {Primitive []} - Returns the primitive array of this collection
     */
    get() {
        return this.collection;
    }

    /**
    * @returns {Primitive} - Returns a specific primitive by index
     */
    get(idx) {
        return this.collection[idx];
    }

    /**
    * @returns {number} - Returns the size of the primitive array
     */
    getLength() {
        return this.collection.length;
    }

    /**
    * @description Deletes all elements in the primitive array
     */
    clear() {
        this.collection = [];
    }

    forEach(callback) {
        this.collection.forEach(callback);
    }

    map(callback) {
        return this.collection.map(callback);
    }

    filter(callback) {
        return this.collection.filter(callback);
    }

    sort(callback) {
        this.collection.sort(callback);
    }

    /**
     * @description Each item in the collection change its data in one time step,
     * note that the drawing step is not included.
     */
    advance() {
        this.collection.forEach(item => item.advance());
    }

    /**
     * @description  Check if the primitive is out of the screen, by default remove it from the collection if so.
     * This function is overridable, overriding in derived class may gives desired result.
     */
    checkBoundary(p5) {
        for (let i = this.collection.length - 1; i >= 0; i--) {
            if (this.collection[i].checkBoundary(p5))
                this.collection.splice(i, 1);
        }
    }

    /**
     * @description  Draw each element in the collection
     */
    draw(p5) {
        this.collection.forEach(item => item.draw(p5));
    }

    /**
     * @description The aggregated step called on each frame, including `advance`, `checkBoundary` and `draw`.
     * Usually used in p5.draw();
     */
    step(p5) {
        this.advance();
        this.checkBoundary(p5);
        this.draw(p5);
    }

    /**
     * @description Set event listener for note played, only one event listener can be set at a time.
     * This decides how the collection will react to the notes.
     */
    setOnNotePlayed(callback) {
        if (this.notePlayedListener)
            document.removeEventListener("notePlayed", this.notePlayedListener);

        this.onNotePlayed = callback;
        //only handle the event when the trackIdx matches or listenToAll is true
        this.notePlayedListener = (e) => {
            if (this.shouldHandleTrack(e.detail.trackNum))
                this.onNotePlayed(e.detail);
        };
        document.addEventListener("notePlayed", this.notePlayedListener);
    }

    /**
     * @description Set event listener for note ended only one event listener can be set at a time.
     * This decides how the collection will react to the notes.
     */
    setOnNoteEnded(callback) {
        if (this.noteEndedListener)
            document.removeEventListener("noteEnded", this.noteEndedListener);

        this.onNoteEnded = callback;
        //only handle the event when the trackIdx matches or listenToAll is true
        this.noteEndedListener = (e) => {
            if (this.shouldHandleTrack(e.detail.trackNum))
                this.onNoteEnded(e.detail);
        };
        document.addEventListener("noteEnded", this.noteEndedListener);
    }

    shouldHandleTrack(trackNum) {
        if (this.listenToAll)
            return true;
        if (this.trackIndexSet)
            return this.trackIndexSet.has(trackNum);
        return trackNum === this.trackIdx;
    }

    /**
     * @description Remove DOM event listeners owned by this collection.
     */
    disposeEventListeners() {
        if (this.notePlayedListener)
            document.removeEventListener("notePlayed", this.notePlayedListener);
        if (this.noteEndedListener)
            document.removeEventListener("noteEnded", this.noteEndedListener);

        this.notePlayedListener = null;
        this.noteEndedListener = null;
    }

    /**
     * @description Set how the color is determined in the default onNotePlayed and onNoteEnded callback.
     * Note that you'll have to specify the color palette 
     * if you are using a custom onNotePlayed / onNoteEnded callback. The colorGenerator only works
     * for default callback.
     */
    setColorGenerator(colorGenerator) {
        this.colorGenerator = colorGenerator;
    }

};

export default Collection;