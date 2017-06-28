'use strict';
var MACROUTILS = require( 'osg/Utils' );
var ShaderGenerator = require( 'osgShader/ShaderGenerator' );
var ShadowCompiler = require( 'osgShadow/ShadowCastCompiler' );

var ShaderGeneratorShadowCast = function () {

    ShaderGenerator.apply( this, arguments );
    this.setShaderCompiler( ShadowCompiler );

};

MACROUTILS.createPrototypeObject( ShaderGeneratorShadowCast, ShaderGenerator.prototype );

module.exports = ShaderGeneratorShadowCast;
