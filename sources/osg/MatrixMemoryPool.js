'use strict';
var mat4 = require('osg/glMatrix').mat4;
var PooledArray = require('osg/PooledArray');

var MatrixMemoryPool = function() {
    PooledArray.call(this);
    this._createFunction = mat4.create;
};
MatrixMemoryPool.prototype = PooledArray.prototype;

module.exports = MatrixMemoryPool;
