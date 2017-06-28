'use strict';
var MACROUTILS = require( 'osg/Utils' );

var OrbitManipulatorWebVRController = function ( manipulator ) {
    this._manipulator = manipulator;
    this.init();
};

MACROUTILS.createPrototypeObject( OrbitManipulatorWebVRController, {
    init: function () {},
    update: function ( q, position ) {
        this._manipulator.setPoseVR( q, position );
    }
} );

module.exports = OrbitManipulatorWebVRController;
