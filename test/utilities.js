import chai from 'chai';

import LinkedRenderStore from '../src/LinkedRenderStore';

const contextDefaults = () => ({
  linkedRenderStore: new LinkedRenderStore(),
  schemaObject: {},
});

function generateContext(properties = {}) {
  const keys = Object.keys(properties);
  const c = {
    childContextTypes: {},
    context: {},
  };
  const defaults = contextDefaults();
  keys.forEach((key) => {
    if (properties[key] === true) {
      c.context[key] = defaults[key];
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
