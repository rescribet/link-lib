var path = require('path');
var libraryName = 'link-lib';

var config = {
  entry: path.resolve('./src/index.js'),
  output: {
    path: path.resolve('./dist'),
    filename: libraryName + '.js',
    library: libraryName,
    libraryTarget: 'commonjs2'
  },
  externals: {
    jsonld: 'jsonld',
    'es6-promise': 'es6-promise',
    rdflib: 'rdflib',
    'rdf-formats-common': 'rdf-formats-common',
    'whatwg-fetch': 'whatwg-fetch',
    'whatwg-url': 'whatwg-url',
    xmlhttprequest: 'xmlhttprequest'
  },
  module: {
    rules: [
      {
        test: /(\.js|\.jsx)$/,
        loader: 'babel-loader',
        exclude: /(bower_components)/,
        options: {
          presets: [
            'react',
            'es2015',
            'stage-0'
          ]
        }
      },
      {
        test: /.json$/,
        use: 'json-loader'
      }
    ]
  },
};

module.exports = config;
