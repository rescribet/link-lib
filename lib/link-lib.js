(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("link-lib", [], factory);
	else if(typeof exports === 'object')
		exports["link-lib"] = factory();
	else
		root["link-lib"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.utilities = undefined;
	
	var _LinkedRenderStore = __webpack_require__(1);
	
	Object.keys(_LinkedRenderStore).forEach(function (key) {
	  if (key === "default" || key === "__esModule") return;
	  Object.defineProperty(exports, key, {
	    enumerable: true,
	    get: function get() {
	      return _LinkedRenderStore[key];
	    }
	  });
	});
	
	var _utilities2 = __webpack_require__(2);
	
	var _utilities = _interopRequireWildcard(_utilities2);
	
	var _LinkedRenderStore2 = _interopRequireDefault(_LinkedRenderStore);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	exports.utilities = _utilities;
	exports.default = _LinkedRenderStore2.default;

/***/ },
/* 1 */
/***/ function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.expandProperty = expandProperty;
	
	function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }
	
	/* eslint no-console: 0 */
	var RENDER_CLASS_NAME = exports.RENDER_CLASS_NAME = 'TYPE_RENDERER_CLASS';
	var DEFAULT_TOPOLOGY = 'DEFAULT_TOPOLOGY';
	
	var NSContext = exports.NSContext = {
	  argu: 'https://argu.co/ns/core#',
	  bibo: 'http://purl.org/ontology/bibo/',
	  cc: 'http://creativecommons.org/ns#',
	  dbo: 'http://dbpedia.org/ontology/',
	  dc: 'http://purl.org/dc/terms/',
	  foaf: 'http://xmlns.com/foaf/0.1/',
	  geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
	  hydra: 'http://www.w3.org/ns/hydra/core#',
	  owl: 'http://www.w3.org/2002/07/owl#',
	  prov: 'http://www.w3.org/ns/prov#',
	  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
	  schema: 'http://schema.org/',
	  skos: 'http://www.w3.org/2004/02/skos/core#',
	  xsd: 'http://www.w3.org/2001/XMLSchema#'
	};
	
	var schema = exports.schema = {
	  '@context': NSContext,
	  '@graph': []
	};
	
	var COMPACT_IRI_REGX = /^(\w+):(\w+)$/;
	var CI_MATCH_LENGTH = 3;
	var CI_MATCH_PREFIX = 1;
	var CI_MATCH_SUFFIX = 2;
	
	function expandProperty(prop) {
	  var matches = prop && prop.match(COMPACT_IRI_REGX);
	  if (matches === null || matches === undefined || matches.length !== CI_MATCH_LENGTH) {
	    return prop;
	  }
	  return '' + NSContext[matches[CI_MATCH_PREFIX]] + matches[CI_MATCH_SUFFIX];
	}
	
	var mineForTypes = function mineForTypes(lookupTypes, chain) {
	  if (typeof lookupTypes === 'undefined') {
	    return chain;
	  }
	  var ont = schema['@graph'].find(function (e) {
	    return lookupTypes.includes(e['@id']);
	  });
	  if (typeof ont !== 'undefined') {
	    chain.push(ont['@id']);
	    var nextSuper = ont['rdfs:subClassOf'] && ont['rdfs:subClassOf']['@id'];
	    return mineForTypes([nextSuper], chain);
	  }
	  return chain;
	};
	
	var mapping = {
	  mapping: {},
	
	  addOntologySchematics: function addOntologySchematics(items) {
	    if (Array.isArray(items)) {
	      var _schema$Graph;
	
	      (_schema$Graph = schema['@graph']).push.apply(_schema$Graph, _toConsumableArray(items));
	    } else {
	      schema['@graph'].push(items);
	    }
	  },
	  getRenderClassForProperty: function getRenderClassForProperty(type, prop) {
	    var topology = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : DEFAULT_TOPOLOGY;
	
	    var props = Array.isArray(prop) ? prop : [prop];
	    var possibleClasses = this.possibleClasses(props, topology);
	    if (possibleClasses.length === 0) {
	      return topology === DEFAULT_TOPOLOGY ? undefined : this.getRenderClassForProperty(type, props, DEFAULT_TOPOLOGY);
	    }
	    for (var i = 0; props.length; i++) {
	      var bestClass = this.bestClassForProp(possibleClasses, type, props);
	      if (this.mapping[bestClass][props[i]][topology]) {
	        return this.mapping[bestClass][props[i]][topology];
	      }
	    }
	    return undefined;
	  },
	  possibleClasses: function possibleClasses(props, topology) {
	    var types = Object.keys(this.mapping);
	    var possibleClasses = [];
	    for (var i = 0; i < types.length; i++) {
	      for (var j = 0; j < props.length; j++) {
	        var classType = this.mapping[types[i]][props[j]] && this.mapping[types[i]][props[j]][topology];
	        if (typeof classType !== 'undefined') {
	          possibleClasses.push(types[i]);
	        }
	      }
	    }
	    return possibleClasses;
	  },
	  bestClassForProp: function bestClassForProp(classes, types, prop) {
	    var chain = mineForTypes(types, types || []);
	    var arrPos = classes.indexOf(chain.find(function (elem) {
	      return classes.indexOf(elem) >= 0;
	    }));
	    console.log('best class for \'' + types + '::' + prop + '\': \'' + classes[arrPos < 0 ? 0 : arrPos] + '\'');
	    return classes[arrPos < 0 ? 0 : arrPos];
	  },
	  getRenderClassForType: function getRenderClassForType(type) {
	    var topology = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_TOPOLOGY;
	
	    debugger;
	    return this.getRenderClassForProperty(type, RENDER_CLASS_NAME, topology);
	  },
	  registerRenderer: function registerRenderer(component, type, property) {
	    var _this = this;
	
	    var topology = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : DEFAULT_TOPOLOGY;
	
	    if (typeof this.mapping[type] === 'undefined') {
	      this.mapping[type] = {};
	    }
	    if (typeof this.mapping[type][RENDER_CLASS_NAME] === 'undefined') {
	      this.mapping[type][RENDER_CLASS_NAME] = {};
	    }
	
	    if (typeof property !== 'undefined') {
	      var arr = Array.isArray(property) ? property : [property];
	      arr.forEach(function (p) {
	        var prop = expandProperty(p);
	        if (typeof _this.mapping[type][prop] === 'undefined') {
	          _this.mapping[type][prop] = {};
	        }
	        _this.mapping[type][prop][topology] = component;
	      });
	    } else {
	      this.mapping[type][RENDER_CLASS_NAME][topology] = component;
	    }
	  }
	};
	
	exports.default = mapping;

/***/ },
/* 2 */
/***/ function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	exports.normalizePropery = normalizePropery;
	exports.propertyIncludes = propertyIncludes;
	function normalizePropery(obj) {
	  if (typeof obj === 'undefined' || obj === false) {
	    return undefined;
	  } else if (obj.constructor === Array) {
	    return obj.map(function (dom) {
	      return dom['@id'];
	    });
	  } else if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object') {
	    return obj['@id'];
	  }
	  throw new Error(typeof obj === 'undefined' ? 'undefined' : _typeof(obj));
	}
	
	function propertyIncludes(obj, include) {
	  if (typeof obj === 'undefined') {
	    return undefined;
	  }
	  var includes = Array.isArray(include) ? include : [include];
	  if (obj.constructor === Array) {
	    return obj.find(function (dom) {
	      return propertyIncludes(dom['@id'], includes);
	    });
	  } else if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object') {
	    return includes.find(function (o) {
	      return o === obj['@id'];
	    });
	  } else if (typeof obj === 'string') {
	    return includes.find(function (o) {
	      return o === obj;
	    });
	  }
	  throw new Error(typeof obj === 'undefined' ? 'undefined' : _typeof(obj));
	}

/***/ }
/******/ ])
});
;
//# sourceMappingURL=link-lib.js.map