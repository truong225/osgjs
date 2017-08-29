'use strict';

var notify = require('osg/notify');
var Texture = require('osg/Texture');
var Uniform = require('osg/Uniform');
var MACROUTILS = require('osg/Utils');
var vec4 = require('osg/glMatrix').vec4;

/**
 * ShadowTexture Attribute encapsulate Texture webgl object
 * with Shadow specificities (no need of texcoord,fragtexcoord)
 * trigger hash change when changing texture precision from float to byt
 * shadowSettings.js header for param explanations
 * @class ShadowTexture
 * @inherits StateAttribute
 */
var ShadowTextureAtlas = function() {
    Texture.call(this);

    this._uniforms = {};
    this._lightNumberArray = []; // default for a valid cloneType

    this._viewMatrices = {};
    this._projectionMatrices = {};
    this._depthRanges = {};
    this._mapSizes = {};
    this._renderSize = vec4.create();
};

ShadowTextureAtlas.uniforms = {};
/** @lends Texture.prototype */

MACROUTILS.createPrototypeStateAttribute(
    ShadowTextureAtlas,
    MACROUTILS.objectInherit(Texture.prototype, {
        cloneType: function() {
            return new ShadowTextureAtlas();
        },

        getLightNumberArray: function() {
            return this._lightNumberArray;
        },

        hasLightNumber: function(lightNum) {
            return this._lightNumberArray.indexOf(lightNum) !== -1;
        },

        setLightNumberArray: function(lightNumberArray) {
            this._lightNumberArray = lightNumberArray;
        },

        getUniformName: function(lightNumber, name) {
            var prefix = 'Shadow_' + this.getType() + lightNumber.toString();
            return 'u' + prefix + '_' + name;
        },

        createUniforms: function(lightNumber, uniforms) {
            uniforms['ViewMatrix_' + lightNumber] = Uniform.createMat4(
                this.getUniformName(lightNumber, 'viewMatrix')
            );
            uniforms['ProjectionMatrix_' + lightNumber] = Uniform.createMat4(
                this.getUniformName(lightNumber, 'projectionMatrix')
            );
            uniforms['DepthRange_' + lightNumber] = Uniform.createFloat4(
                this.getUniformName(lightNumber, 'depthRange')
            );
            uniforms['MapSize_' + lightNumber] = Uniform.createFloat4(
                this.getUniformName(lightNumber, 'mapSize')
            );
            uniforms['RenderSize_' + lightNumber] = uniforms['RenderSize'];
        },

        getOrCreateUniforms: function(unit) {
            // uniform are once per CLASS attribute, not per instance
            var obj = ShadowTextureAtlas;
            notify.assert(unit !== undefined || this._lightNumberArray.length !== 0);

            if (obj.uniforms[unit] !== undefined) {
                return obj.uniforms[unit];
            }

            var uniforms = (obj.uniforms[unit] = {});

            // shadowmap texture size used for texel space which is viewport independant
            var renderSizeUniform = Uniform.createFloat4(this.getUniformName(0, 'renderSize'));
            uniforms['RenderSize'] = renderSizeUniform;

            for (var i = 0, l = this._lightNumberArray.length; i < l; i++) {
                this.createUniforms(this._lightNumberArray[i], uniforms);
            }

            // Dual Uniform of texture, needs:
            // - Sampler (type of texture)
            // - Int (texture unit)
            // tells Shader Program where to find it
            var name = 'Texture' + unit;
            var uniform = Uniform.createInt1(unit, name);
            uniforms[name] = uniform;

            return obj.uniforms[unit];
        },

        setViewMatrix: function(lightNumber, viewMatrix) {
            this._viewMatrices[lightNumber] = viewMatrix;
        },

        setProjectionMatrix: function(lightNumber, projectionMatrix) {
            this._projectionMatrices[lightNumber] = projectionMatrix;
        },

        setDepthRange: function(lighNumber, depthRange) {
            this._depthRanges[lighNumber] = depthRange;
        },

        setLightShadowMapSize: function(lightNumber, dimension) {
            this._mapSizes[lightNumber] = dimension;
        },

        apply: function(state, texUnit) {
            // Texture stuff: call parent class method
            Texture.prototype.apply.call(this, state, texUnit);

            if (this._lightNumberArray.length === 0) {
                return;
            }

            // update Uniforms
            var uniformMap = this.getOrCreateUniforms(texUnit);

            for (var i = 0, l = this._lightNumberArray.length; i < l; i++) {
                var lightNumber = this._lightNumberArray[i];

                if (!uniformMap['ViewMatrix_' + lightNumber]) {
                    // enable disable uniforms and yet using getOrCreate
                    this.createUniforms(lightNumber, uniformMap);
                }

                uniformMap['ViewMatrix_' + lightNumber].setMatrix4(this._viewMatrices[lightNumber]);
                uniformMap['ProjectionMatrix_' + lightNumber].setMatrix4(
                    this._projectionMatrices[lightNumber]
                );
                uniformMap['DepthRange_' + lightNumber].setFloat4(this._depthRanges[lightNumber]);
                uniformMap['MapSize_' + lightNumber].setFloat4(this._mapSizes[lightNumber]);
                uniformMap['RenderSize_' + lightNumber].setFloat4(this._renderSize);
            }

            uniformMap['RenderSize'].setFloat4(this._renderSize);
        },

        setTextureSize: function(w, h) {
            this._renderSize[0] = w;
            this._renderSize[1] = h;
            this._renderSize[2] = 1.0 / w;
            this._renderSize[3] = 1.0 / h;
            Texture.prototype.setTextureSize.call(this, w, h);
            this.dirty();
        },

        getHash: function() {
            var hash = this.getTypeMember();
            for (var i = 0, l = this._lightNumberArray.length; i < l; i++) {
                hash += '_' + this._lightNumberArray[i];
            }
            hash += '_' + this._type;
            return hash;
        }
    }),
    'osgShadow',
    'ShadowTextureAtlas'
);

module.exports = ShadowTextureAtlas;
