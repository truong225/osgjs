'use strict';
var mat4 = require('osg/glMatrix').mat4;
var TemplatePool = require('osg/TemplatePool');

var MatrixMemoryPool = function() {
    TemplatePool.call(this);
    this._createFunction = mat4.create;
};
MatrixMemoryPool.prototype = TemplatePool.prototype;

module.exports = MatrixMemoryPool;
