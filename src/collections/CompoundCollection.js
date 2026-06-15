class CompoundCollection {
    /** 
    @description The array of collections
    */
    collections;

    constructor() {
        this.collections = [];
    }

    /** 
     @description Adding a collection to the set
     */
    addCollection(collection) {
        this.collections.push(collection);
    }

    /** 
     @description Remove a collection by its index
     */
    removeCollection(idx) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        if (this.collections[idx].disposeEventListeners)
            this.collections[idx].disposeEventListeners();
        this.collections.splice(idx, 1);
    }

    /**
     *  @param {number} idx - The index of the collection
     *  @param {boolean} listenToAll - If the collection listens to all tracks
     *  @description Set if the colllection listens to all track
     */
    setCollectionListenToAll(idx, listenToAll) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        this.collections[idx].setListenToAll(listenToAll);
    };

    /**
     *  @param {number} idx - The index of the collection
     *  @param {number} trackIdx - The index of the music track
     *  @description Set the collection (specified by idx) listens to event from the track (specified by trackIdx)
     */
    setCollectionListen(idx, trackIdx) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        this.collections[idx].setTrackIdx(trackIdx);
        this.setCollectionListenToAll(idx, false);
    }

    get() {
        return this.collections;
    }

    get(idx) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        return this.collections[idx];
    }

    getLength() {
        return this.collections.length;
    }

    step(p5) {
        this.collections.forEach(collection => {
            collection.step(p5);
        });
    }

    draw(p5) {
        this.collections.forEach(collection => {
            collection.draw(p5);
        });
    }

    advance() {
        this.collections.forEach(collection => {
            collection.advance();
        });
    }

    checkBoundary(p5) {
        this.collections.forEach(collection => {
            collection.checkBoundary(p5);
        });
    }

    clearAll() {
        this.collections.forEach(collection => {
            if (collection.disposeEventListeners)
                collection.disposeEventListeners();
            collection.clear();
        });
    }

    //set event listener for note played, only one event listener can be set at a time for each track
    setOnNotePlayed(idx, callback) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        this.collections[idx].setOnNotePlayed(callback);
    }

    //set event listener for note ended, only one event listener can be set at a time for each track
    setOnNoteEnded(idx, callback) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        this.collections[idx].setOnNoteEnded(callback);
    }


    //set colorGenerator for the specified collection
    setColorGenerator(idx, generator) {
        console.assert(idx < this.collections.length && idx >= 0, { msg: "Invalid collection index" });
        this.collections[idx].setColorGenerator(generator);
    }

    //set color generator for all collections, creating a consistent color scheme
    setAllColorGenerators(generator) {
        this.collections.forEach(collection => {
            collection.setColorGenerator(generator);
        });
    }
};

export default CompoundCollection;