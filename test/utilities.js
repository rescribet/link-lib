import chai from 'chai';

import LinkedRenderStore from '../src/LinkedRenderStore';

const lrs = LinkedRenderStore;
const contextDefaults = {
  linkedRenderStore: lrs,
  schemaObject: {},
};

function generateContext(properties = {}) {
  const keys = Object.keys(properties);
  const c = {
    childContextTypes: {},
    context: {},
  };
  keys.forEach((key) => {
    if (properties[key] === true) {
      c.context[key] = contextDefaults[key];
    } else if (properties[key] !== undefined) {
      c.context[key] = properties[key];
    }
  });
  return c;
}

export {
  chai,
  generateContext,
};
