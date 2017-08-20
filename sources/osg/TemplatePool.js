'use strict';

var TemplatePool = function(createFunction) {
    this._createFunction = createFunction;
    this._pool = [];
    this._length = 0;
};

/** @lends MatrixMemoryPool.prototype */
TemplatePool.prototype = {
    // start reuse the stack
    reset: function() {
        this._length = 0;
    },
    getArray: function() {
        return this._pool;
    },
    back: function() {
        return this._pool[this._length - 1];
    },
    pop: function() {
        this._length--;
    },
    push: function(value) {
        if (this._length === this._pool.length) {
            this._pool.push(value);
        } else {
            this._pool[this._length] = value;
        }
        this._length++;
    },
    getOrCreate: function() {
        var obj;
        if (this._length === this._pool.length) {
            obj = this._createFunction();
            this._pool.push(obj);
        } else {
            obj = this._pool[this._length];
        }
        this._length++;
        return obj;
    }
};

module.exports = TemplatePool;
