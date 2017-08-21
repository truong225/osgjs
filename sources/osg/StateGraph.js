'use strict';
var MACROUTILS = require('osg/Utils');
var TemplatePool = require('osg/TemplatePool');

var StateGraph = function() {
    this._depth = 0;
    this._children = {};
    this._childrenKeys = new TemplatePool();
    this._leafs = new TemplatePool();
    this._stateset = undefined;
    this._parent = undefined;
};

var createStateGraph = function() {
    return new StateGraph();
};

StateGraph.stateGraphPool = new TemplatePool(createStateGraph);
StateGraph.statsNbMoveStateGraph = 0;

StateGraph.reset = function() {
    StateGraph.stateGraphPool.reset();
    StateGraph.statsNbMoveStateGraph = 0;
};

MACROUTILS.createPrototypeObject(
    StateGraph,
    {
        clean: function() {
            this._leafs.reset();
            var keys = this._childrenKeys.getArray();
            for (var i = 0, l = this._childrenKeys._length; i < l; i++) {
                var key = keys[i];
                this._children[key] = undefined;
            }
            this._childrenKeys.reset();
            this._depth = 0;
            this._stateset = undefined;
            this._parent = undefined;
        },
        getStateSet: function() {
            return this._stateset;
        },
        getLeafs: function() {
            return this._leafs;
        },
        getParent: function() {
            return this._parent;
        },
        findOrInsert: function(stateset) {
            // nb call per frame as example: 22 (shadowmap) 55 (pbr) to 512 (performance)
            // it's called by node that have a stateSet
            var sg;
            var stateSetID = stateset.getInstanceID();

            if (!this._children[stateSetID]) {
                sg = StateGraph.stateGraphPool.getOrCreate();
                this._childrenKeys.push(stateSetID);
                sg.clean();

                sg._parent = this;
                sg._depth = this._depth + 1;
                sg._stateset = stateset;
                this._children[stateSetID] = sg;
            } else {
                sg = this._children[stateSetID];
            }
            return sg;
        }
    },
    'osg',
    'StateGraph'
);

StateGraph.moveStateGraph = function(state, sgCurrentArg, sgNewArg) {
    StateGraph.statsNbMoveStateGraph++;
    // nb call per frame: 3 (pbr) 10 (shadowmap) 1(performance)
    var stack = [];
    var sgNew = sgNewArg;
    var sgCurrent = sgCurrentArg;
    var i, l;
    if (sgNew === sgCurrent || sgNew === undefined) return;

    if (sgCurrent === undefined) {
        // push stateset from sgNew to root, and apply
        // stateset from root to sgNew
        do {
            if (sgNew._stateset !== undefined) {
                stack.push(sgNew._stateset);
            }
            sgNew = sgNew._parent;
        } while (sgNew);

        for (i = stack.length - 1, l = 0; i >= l; --i) {
            state.pushStateSet(stack[i]);
        }
        return;
    } else if (sgCurrent._parent === sgNew._parent) {
        // first handle the typical case which is two state groups
        // are neighbours.

        // state has changed so need to pop old state.
        if (sgCurrent._stateset !== undefined) {
            state.popStateSet();
        }
        // and push new state.
        if (sgNew._stateset !== undefined) {
            state.pushStateSet(sgNew._stateset);
        }
        return;
    }

    // need to pop back up to the same depth as the new state group.
    while (sgCurrent._depth > sgNew._depth) {
        if (sgCurrent._stateset !== undefined) {
            state.popStateSet();
        }
        sgCurrent = sgCurrent._parent;
    }

    // use return path to trace back steps to sgNew.
    stack = [];

    // need to pop back up to the same depth as the curr state group.
    while (sgNew._depth > sgCurrent._depth) {
        if (sgNew._stateset !== undefined) {
            stack.push(sgNew._stateset);
        }
        sgNew = sgNew._parent;
    }

    // now pop back up both parent paths until they agree.

    // DRT - 10/22/02
    // should be this to conform with above case where two StateGraph
    // nodes have the same parent
    while (sgCurrent !== sgNew) {
        if (sgCurrent._stateset !== undefined) {
            state.popStateSet();
        }
        sgCurrent = sgCurrent._parent;

        if (sgNew._stateset !== undefined) {
            stack.push(sgNew._stateset);
        }
        sgNew = sgNew._parent;
    }

    for (i = stack.length - 1, l = 0; i >= l; --i) {
        state.pushStateSet(stack[i]);
    }
};

module.exports = StateGraph;
