// var path = require('path');
var libraryName = 'link-lib';

var config = {
  entry: './src/index.js',
  output: {
    path: './dist',
    filename: libraryName + '.js',
    library: libraryName,
    libraryTarget: 'commonjs2'
  },
  externals: {
    jsonld: 'jsonld',
    'es6-promise': 'es6-promise',
    'rdf-ext': 'rdf-ext',
    'rdf-formats-common': 'rdf-formats-common',
    'whatwg-fetch': 'whatwg-fetch'
  },
  module: {
    rules: [
      {
        test: /(\.js|\.jsx)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      },
      {
        test: /.json$/,
        use: 'json-loader'
      }
    ]
  },
};

module.exports = config;
