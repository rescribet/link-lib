// Write jest like rspec tests
// https://github.com/negativetwelve/jest-plugins/tree/master/packages/jest-plugins
global.fetch = require('jest-fetch-mock');

require('jest-plugins')([
  'jest-plugin-action',
  'jest-plugin-context',
  'jest-plugin-its',
  'jest-plugin-set',
]);
