'use strict';
var MACROUTILS = require( 'osg/Utils' );

var FirstPersonManipulatorWebVRController = function ( manipulator ) {
    this._manipulator = manipulator;
    this.init();
};

MACROUTILS.createPrototypeObject( FirstPersonManipulatorWebVRController, {
    init: function () {},
    update: function ( q, position ) {
        this._manipulator.setPoseVR( q, position );
    }
} );

module.exports = FirstPersonManipulatorWebVRController;
