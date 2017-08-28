'use strict';
var MACROUTILS = require('osg/Utils');
var vec3 = require('osg/glMatrix').vec3;
var BoundingBox = require('osg/BoundingBox');
var PrimitiveIndexFunctor = require('osg/PrimitiveIndexFunctor');
var primitiveSet = require('osg/primitiveSet');
var notify = require('osg/notify');

// **** GENERAL INFO ON KDTREE ****
// A KdTree is a Spatial Partitionning Tree (http://en.wikipedia.org/wiki/Space_partitioning)
// The type of tree is sort of defined by the splitting axis method:
// - Per Axis split (octree/ kdtree)
// - Arbritrary direction split (bsp)

// The algorithm used for splitting, the name for finding best split is 'Surface Area Heuristic (SAH)'
// Octree divide the space in 8 subspace (one box -> 8 sub boxes)
// whereas kdtree does it by splitting population number in two equal group

// Kd Tree http://en.wikipedia.org/wiki/K-d_tree
// a given set of points is sorted along one Axis (e.g. X).
// The sorted list is split at the median.
// The result are two sets, one for each half-space (left and right).

// Then, for the current node, the splitting-plane position (or the median-point) and depth is saved.
// Finally, if the point-set has more than n point and the tree depth is below m
// (with n,m chosen by the user, as build options), two child-nodes (L/R one for each point-set)
// are created which themselfs repeat the pocedure.

// The split-axis gets alternated at each depth, the split order is computed by checking the main
// bounding box the length of its axis
// **** GENERAL INFO ON KDTREE ****

// The KdTree implemented here is flattened, ie, a node and its children all lie in the same array
// The most important thing is the understanding of the variables first and second for each node
// Their semantic depend if the node is a leaf or not
// if it's a leaf :
//   first and second defines a range in the triangles array (triangles in the cell)
// if it's not a leaf :
// - first and second respectively represents the left and right sub children
// We know that a node is a leaf if first is negative, in that case the range will be defined by
// [ -first - 1, -first-1 + second ]
var KdNode = function(first, second) {
    this._bb = new BoundingBox();
    this._first = first;
    this._second = second;
    // These variables represent the local clipped ray (for intersection test)
    // They are mostly temporary because they are recomputed for each intersection test
    this._nodeRayStart = vec3.create();
    this._nodeRayEnd = vec3.create();
};

var InfoCollector = function() {
    this._numVertexIndices = 0;
};

InfoCollector.prototype = {
    apply: function(node) {
        if (!node.getAttributes().Vertex) {
            return;
        }
        var self = this;
        // The callback must be defined as a closure
        /* jshint asi: true */
        var cb = function() {
            return {
                // We need to count also the index spent in numVertices per primite
                operatorPoint: function() {
                    self._numVertexIndices += 2;
                },
                operatorLine: function() {
                    self._numVertexIndices += 3;
                },
                operatorTriangle: function() {
                    self._numVertexIndices += 4;
                }
            };
        };
        var pf = new PrimitiveIndexFunctor(node, cb);
        pf.apply();
    }
};

var PrimitiveIndicesCollector = function(buildKdTree) {
    this._buildKdTree = buildKdTree;
    this._numIndices = 0;
};

PrimitiveIndicesCollector.prototype = {
    buildKdTreePoint: function(i0) {
        var vertices = this._buildKdTree._kdTree.getVertices();
        var iv = i0 * 3;
        this._buildKdTree._kdTree.addPoint(i0);
        this._buildKdTree._primitiveIndices[this._numIndices] = this._numIndices;
        var centers = this._buildKdTree._centers;
        var idCenter = this._numIndices * 3;
        centers[idCenter] = vertices[iv];
        centers[idCenter + 1] = vertices[iv + 1];
        centers[idCenter + 2] = vertices[iv + 2];
        this._numIndices++;
    },

    buildKdTreeLine: function(i0, i1) {
        if (i0 === i1) return;
        var vertices = this._buildKdTree._kdTree.getVertices();
        var iv0 = i0 * 3;
        var iv1 = i1 * 3;

        this._buildKdTree._kdTree.addLine(i0, i1);

        var numIndices = this._numIndices;
        this._buildKdTree._primitiveIndices[numIndices] = numIndices;

        var idCenter = numIndices * 3;

        var v0x = vertices[iv0];
        var v0y = vertices[iv0 + 1];
        var v0z = vertices[iv0 + 2];

        var v1x = vertices[iv1];
        var v1y = vertices[iv1 + 1];
        var v1z = vertices[iv1 + 2];

        var minx = v0x < v1x ? v0x : v1x;
        var miny = v0y < v1y ? v0y : v1y;
        var minz = v0z < v1z ? v0z : v1z;

        var maxx = v0x > v1x ? v0x : v1x;
        var maxy = v0y > v1y ? v0y : v1y;
        var maxz = v0z > v1z ? v0z : v1z;

        var centers = this._buildKdTree._centers;
        centers[idCenter] = (minx + maxx) * 0.5;
        centers[idCenter + 1] = (miny + maxy) * 0.5;
        centers[idCenter + 2] = (minz + maxz) * 0.5;

        this._numIndices++;
    },

    buildKdTreeTriangle: function(i0, i1, i2) {
        if (i0 === i1 || i0 === i2 || i1 === i2) return;

        var vertices = this._buildKdTree._kdTree.getVertices();
        var iv0 = i0 * 3;
        var iv1 = i1 * 3;
        var iv2 = i2 * 3;

        this._buildKdTree._kdTree.addTriangle(i0, i1, i2);

        var numIndices = this._numIndices;
        this._buildKdTree._primitiveIndices[numIndices] = numIndices;

        var idCenter = numIndices * 3;

        var v0x = vertices[iv0];
        var v0y = vertices[iv0 + 1];
        var v0z = vertices[iv0 + 2];

        var v1x = vertices[iv1];
        var v1y = vertices[iv1 + 1];
        var v1z = vertices[iv1 + 2];

        var v2x = vertices[iv2];
        var v2y = vertices[iv2 + 1];
        var v2z = vertices[iv2 + 2];

        var minx = v0x < v1x ? (v0x < v2x ? v0x : v2x) : v1x < v2x ? v1x : v2x;
        var miny = v0y < v1y ? (v0y < v2y ? v0y : v2y) : v1y < v2y ? v1y : v2y;
        var minz = v0z < v1z ? (v0z < v2z ? v0z : v2z) : v1z < v2z ? v1z : v2z;

        var maxx = v0x > v1x ? (v0x > v2x ? v0x : v2x) : v1x > v2x ? v1x : v2x;
        var maxy = v0y > v1y ? (v0y > v2y ? v0y : v2y) : v1y > v2y ? v1y : v2y;
        var maxz = v0z > v1z ? (v0z > v2z ? v0z : v2z) : v1z > v2z ? v1z : v2z;

        var centers = this._buildKdTree._centers;
        centers[idCenter] = (minx + maxx) * 0.5;
        centers[idCenter + 1] = (miny + maxy) * 0.5;
        centers[idCenter + 2] = (minz + maxz) * 0.5;

        this._numIndices++;
    },

    apply: function(node) {
        if (!node.getAttributes().Vertex) {
            return;
        }
        var self = this;
        // The callback must be defined as a closure
        /* jshint asi: true */
        var cb = function() {
            return {
                operatorPoint: function(i0) {
                    self.buildKdTreePoint(i0);
                },
                operatorLine: function(i1, i2) {
                    self.buildKdTreeLine(i1, i2);
                },
                operatorTriangle: function(i1, i2, i3) {
                    self.buildKdTreeTriangle(i1, i2, i3);
                }
            };
        };
        var pf = new PrimitiveIndexFunctor(node, cb);
        pf.apply();
    }
};

var BuildKdTree = function(kdTree) {
    this._kdTree = kdTree;
    this._bb = new BoundingBox();
    this._primitiveIndices = undefined; // Uint32Array
    this._centers = undefined; // Float32Array
    this._axisOrder = vec3.create();
    this._stackLength = 0;
};

BuildKdTree.prototype = {
    build: function(options, geom) {
        var targetTris = options._targetNumTrianglesPerLeaf;
        var vertexAttrib = geom.getVertexAttributeList().Vertex;
        if (!vertexAttrib) return false;
        var vertices = vertexAttrib.getElements();
        if (!vertices) return false;
        var nbVertices = vertices.length / 3;
        if (nbVertices < targetTris) return false;

        this._bb.copy(geom.getBoundingBox());
        this._kdTree.setVertices(vertices);

        this.computeDivisions(options);
        options._numVerticesProcessed += nbVertices;

        var totalLenArray = 0;
        var geomPrimitives = geom.getPrimitiveSetList();
        var nbPrimitives = geomPrimitives.length;

        for (var i = 0; i < nbPrimitives; i++) {
            var prim = geomPrimitives[i];
            var mode = prim.getMode();
            if (mode === primitiveSet.TRIANGLE_STRIP || mode === primitiveSet.TRIANGLE_FAN)
                totalLenArray += Math.abs(prim.getCount() - 2) * 3;
            else totalLenArray += prim.getCount() * 3;
        }

        var infoCollector = new InfoCollector(this);
        infoCollector.apply(geom);
        var vertexIndicesSize = infoCollector._numVertexIndices;

        this._primitiveIndices = new Uint32Array(totalLenArray / 3);
        this._centers = new Float32Array(totalLenArray);

        // init kdtree arrays
        // Check if we can use Uint16 later
        this._kdTree.setPrimitiveIndices(new Uint32Array(totalLenArray));
        var vertexIndicesArray =
            nbVertices > 65535
                ? new Uint32Array(vertexIndicesSize)
                : new Uint16Array(vertexIndicesSize);
        this._kdTree.setVertexIndices(vertexIndicesArray);

        var pic = new PrimitiveIndicesCollector(this);
        pic.apply(geom);

        // Adjust sizes
        var kdPrimIndices = this._kdTree
            .getPrimitiveIndices()
            .slice(0, this._kdTree.getNumPrimitiveIndices());
        this._kdTree.setPrimitiveIndices(kdPrimIndices);
        var kdVertexIndices = this._kdTree
            .getVertexIndices()
            .slice(0, this._kdTree.getNumVertexIndices());
        this._kdTree.setVertexIndices(kdVertexIndices);

        this._primitiveIndices = this._primitiveIndices.slice(0, pic._numIndices);
        this._centers = this._centers.slice(0, pic._numIndices * 3);

        var node = new KdNode(-1, this._primitiveIndices.length);
        node._bb.copy(this._bb);
        var nodeNum = this._kdTree.addNode(node);

        var bb = new BoundingBox();
        bb.copy(this._bb);
        this.divide(options, bb, nodeNum, 0);

        var primitiveIndices = this._kdTree.getPrimitiveIndices();

        nbPrimitives = this._primitiveIndices.length;
        for (i = 0; i < nbPrimitives; ++i) {
            this._primitiveIndices[i] = primitiveIndices[this._primitiveIndices[i]];
        }
        this._kdTree.setPrimitiveIndices(this._primitiveIndices);

        return this._kdTree.getNodes().length > 0;
    },

    computeDivisions: function(options) {
        this._stackLength = options._maxNumLevels;
        var max = this._bb._max;
        var min = this._bb._min;
        var dx = max[0] - min[0];
        var dy = max[1] - min[1];
        var dz = max[2] - min[2];
        var axisOrder = this._axisOrder;

        // We set the cutting order (longest edge aabb first)
        axisOrder[0] = dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2;
        axisOrder[2] = dx < dy && dx < dz ? 0 : dy < dz ? 1 : 2;
        var sum = axisOrder[0] + axisOrder[2];
        axisOrder[1] = sum === 3 ? 0 : sum === 2 ? 1 : 2;
    },
    // The core function of the kdtree building
    // It checks if the node needs to be subdivided or not
    // If it's a leaf, it computes the final bounding box of the node
    // and it ends here
    // If it's a node, then it puts the splitting axis position on the median population
    // On the same time it reorders the triangle index array
    divide: function(options, bb, nodeIndex, level) {
        var kdTree = this._kdTree;
        var primitives = this._primitiveIndices;
        var nodes = kdTree.getNodes();
        var node = nodes[nodeIndex];

        var first = node._first;
        var second = node._second;

        var needToDivide =
            level < this._stackLength && first < 0 && second > options._targetNumTrianglesPerLeaf;
        var istart = -first - 1;
        var iend = istart + second - 1;

        if (!needToDivide) {
            if (first < 0) {
                // leaf is done, now compute bound on it.
                this.computeNodeBox(node, istart, iend);
            }
            return nodeIndex;
        }

        if (first >= 0) return nodeIndex;
        // leaf node as first < 0, so look at dividing it.

        var axis = this._axisOrder[level % 3];
        var originalMin = bb._min[axis];
        var originalMax = bb._max[axis];

        var mid = (originalMin + originalMax) * 0.5;

        var originalLeftChildIndex = 0;
        var originalRightChildIndex = 0;
        var insitueDivision = false;

        var left = istart;
        var right = iend;

        var centers = this._centers;
        while (left < right) {
            while (left < right && centers[primitives[left] * 3 + axis] <= mid) {
                ++left;
            }

            while (left < right && centers[primitives[right] * 3 + axis] > mid) {
                --right;
            }

            if (left < right) {
                var tmp = primitives[left];
                primitives[left] = primitives[right];
                primitives[right] = tmp;
                ++left;
                --right;
            }
        }

        if (left === right) {
            if (centers[primitives[left] * 3 + axis] <= mid) ++left;
            else --right;
        }

        if (right - istart <= -1) {
            originalLeftChildIndex = 0;
            originalRightChildIndex = nodeIndex;
            insitueDivision = true;
        } else if (iend - left <= -1) {
            originalLeftChildIndex = nodeIndex;
            originalRightChildIndex = 0;
            insitueDivision = true;
        } else {
            originalLeftChildIndex = kdTree.addNode(new KdNode(-istart - 1, right - istart + 1));
            originalRightChildIndex = kdTree.addNode(new KdNode(-left - 1, iend - left + 1));
        }

        var restore = bb._max[axis];
        bb._max[axis] = mid;

        var leftChildIndex =
            originalLeftChildIndex !== 0
                ? this.divide(options, bb, originalLeftChildIndex, level + 1)
                : 0;

        bb._max[axis] = restore;

        restore = bb._min[axis];
        bb._min[axis] = mid;

        var rightChildIndex =
            originalRightChildIndex !== 0
                ? this.divide(options, bb, originalRightChildIndex, level + 1)
                : 0;

        bb._min[axis] = restore;

        if (!insitueDivision) {
            node._first = leftChildIndex;
            node._second = rightChildIndex;

            insitueDivision = true;

            var bnode = node._bb;
            bnode.init();
            if (leftChildIndex !== 0) bnode.expandByBoundingBox(nodes[leftChildIndex]._bb);
            if (rightChildIndex !== 0) bnode.expandByBoundingBox(nodes[rightChildIndex]._bb);
        }
        return nodeIndex;
    },
    // It computes the bounding box of the node so that the box contains all the triangles
    // of the cell
    computeNodeBox: function(node, istart, iend) {
        var minx = Infinity,
            miny = Infinity,
            minz = Infinity,
            maxx = -Infinity,
            maxy = -Infinity,
            maxz = -Infinity;
        var vertexIndices = this._kdTree.getVertexIndices();
        var primitives = this._kdTree.getPrimitiveIndices();
        var vertices = this._kdTree.getVertices();
        for (var i = istart; i <= iend; ++i) {
            var primitiveIndex = primitives[this._primitiveIndices[i]];
            var numPoints = vertexIndices[primitiveIndex++];
            for (var j = 0; j < numPoints; ++j) {
                var vi = vertexIndices[primitiveIndex++] * 3;
                var vx = vertices[vi];
                var vy = vertices[vi + 1];
                var vz = vertices[vi + 2];

                if (vx < minx) minx = vx;
                if (vy < miny) miny = vy;
                if (vz < minz) minz = vz;

                if (vx > maxx) maxx = vx;
                if (vy > maxy) maxy = vy;
                if (vz > maxz) maxz = vz;
            }
        }
        var epsilon = 1e-6;
        var bnode = node._bb;
        var bmin = bnode._min;
        var bmax = bnode._max;
        bmin[0] = minx - epsilon;
        bmin[1] = miny - epsilon;
        bmin[2] = minz - epsilon;
        bmax[0] = maxx + epsilon;
        bmax[1] = maxy + epsilon;
        bmax[2] = maxz + epsilon;
    }
};

var KdTree = function() {
    this._vertices = null;
    this._kdNodes = [];
    this._primitiveIndices = undefined;
    this._vertexIndices = undefined;
    this._numVertexIndices = 0;
    this._numPrimitiveIndices = 0;
};

MACROUTILS.createPrototypeObject(
    KdTree,
    {
        getVertices: function() {
            return this._vertices;
        },
        setVertices: function(vertices) {
            this._vertices = vertices;
        },

        getNumPrimitiveIndices: function() {
            return this._numPrimitiveIndices;
        },

        getNumVertexIndices: function() {
            return this._numVertexIndices;
        },

        setPrimitiveIndices: function(indices) {
            this._primitiveIndices = indices;
        },
        getPrimitiveIndices: function() {
            return this._primitiveIndices;
        },

        // vector containing the primitive vertex index data packed as no_vertice_indices then vertex indices
        // ie. for points it's (1, p0), for lines (2, p0, p1) etc.
        setVertexIndices: function(indices) {
            this._vertexIndices = indices;
        },

        getVertexIndices: function() {
            return this._vertexIndices;
        },

        getNodes: function() {
            return this._kdNodes;
        },

        addPoint: function(p0) {
            var i = this._numVertexIndices;
            this._primitiveIndices[this._numPrimitiveIndices++] = i;
            this._vertexIndices[this._numVertexIndices++] = 1;
            this._vertexIndices[this._numVertexIndices++] = p0;
        },

        addLine: function(p0, p1) {
            var i = this._numVertexIndices;
            this._primitiveIndices[this._numPrimitiveIndices++] = i;
            this._vertexIndices[this._numVertexIndices++] = 2;
            this._vertexIndices[this._numVertexIndices++] = p0;
            this._vertexIndices[this._numVertexIndices++] = p1;
        },

        addTriangle: function(p0, p1, p2) {
            var i = this._numVertexIndices;
            this._primitiveIndices[this._numPrimitiveIndices++] = i;
            this._vertexIndices[this._numVertexIndices++] = 3;
            this._vertexIndices[this._numVertexIndices++] = p0;
            this._vertexIndices[this._numVertexIndices++] = p1;
            this._vertexIndices[this._numVertexIndices++] = p2;
        },

        addNode: function(node) {
            this._kdNodes.push(node);
            return this._kdNodes.length - 1;
        },
        build: function(options, geom) {
            var buildTree = new BuildKdTree(this);
            return buildTree.build(options, geom);
        },

        _intersectFunctor: function(functor, node) {
            // treat as a leaf
            var istart = -node._first - 1;
            var iend = istart + node._second;
            var vertexIndices = this._vertexIndices;
            var vertices = this._vertices;

            for (var i = istart; i < iend; ++i) {
                var primitiveIndex = this._primitiveIndices[i];
                var numVertices = vertexIndices[primitiveIndex++];
                if (numVertices === 3) {
                    functor.intersectTriangle(
                        vertices,
                        i,
                        vertexIndices[primitiveIndex],
                        vertexIndices[primitiveIndex + 1],
                        vertexIndices[primitiveIndex + 2]
                    );
                } else if (numVertices === 2) {
                    functor.intersectLine(
                        vertices,
                        i,
                        vertexIndices[primitiveIndex],
                        vertexIndices[primitiveIndex + 1]
                    );
                } else if (numVertices === 1) {
                    functor.intersectPoint(vertices, i, vertexIndices[primitiveIndex]);
                } else {
                    notify.error(
                        'Warning: KdTree::intersect() encounted unsupported primitive size of ' +
                            numVertices
                    );
                }
            }
        },

        intersect: function(functor, node) {
            if (node._first < 0) {
                this._intersectFunctor(functor, node);
                return;
            }

            if (functor.enter(node._bb)) {
                if (node._first > 0) {
                    this.intersect(functor, this._kdNodes[node._first]);
                }

                if (node._second > 0) {
                    this.intersect(functor, this._kdNodes[node._second]);
                }
                functor.leave();
            }
        },
        intersectLineSegment: function(functor, node, ls, le) {
            if (node._first < 0) {
                this._intersectFunctor(functor, node);
                return;
            }

            var s = node._nodeRayStart;
            var e = node._nodeRayEnd;
            vec3.copy(s, ls);
            vec3.copy(e, le);
            var kNodes = this._kdNodes;
            var kNode;
            if (node._first > 0) {
                kNode = kNodes[node._first];
                if (functor.enter(kNode._bb, s, e)) this.intersectLineSegment(functor, kNode, s, e);
            }

            if (node._second > 0) {
                vec3.copy(s, ls);
                vec3.copy(e, le);
                kNode = kNodes[node._second];
                if (functor.enter(kNode._bb, s, e)) this.intersectLineSegment(functor, kNode, s, e);
            }
        }
    },
    'osg',
    'KdTree'
);

module.exports = KdTree;
