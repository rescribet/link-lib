# Link Library
*A Link to the Web*

[![Build Status](https://travis-ci.org/fletcher91/link-lib.svg?branch=master)](https://travis-ci.org/fletcher91/link-lib)

This is the library which powers the Argu Open Data platform. It provides an interface to build data-independent
semantic applications for the human consumption of linked data.

This was built at [Argu](https://argu.co), if you like what we do, these technologies
or open data, send us [a mail](mailto:info@argu.co).

## Installation

`npm install link-lib`

`yarn add link-lib`

The package externalizes the Promise API, so make sure to include your own.

# Usage

This package is meant primarily for ontology connector developers,
see the [link-redux](https://github.com/fletcher91/link-redux) documentation for main usage notes.

### Setting up the worker

Unless you [need to support IE9](http://caniuse.com/#feat=webworkers), web workers are a good way to
delegate data processing from the render thread, so using it is a wise thing to do (but it has a
fallback). See [webpack's worker-loader](https://github.com/webpack/worker-loader) for easy 
inclusion of workers (which is used in these examples).

Check if the worker API is present, and switch to the worker version if it is:
```Ruby
import DataWorker from 'worker-loader!../workers/DataWorker';
import transformers from './transformers';

if (typeof window !== 'undefined' && window.Worker) {
  LinkedRenderStore.api.processor = new DataWorkerLoader(DataWorker);
} else {
  transformers.transformers.forEach(
    (t) => LinkedRenderStore.api.registerTransformer(t.transformer, t.mediaTypes, t.acceptValue)
  )
}
```

Initialize the worker `workers/DataWorker.js`:
```
import { DataWorker } from 'link-lib';

# This is needed if you need to process an XML-based format as well as JSON. 
import { DOMParser } from 'xmldom';
self.DOMParser = DOMParser;

import transformers from '../helpers/transformers';

DataWorker(transformers);
```

And create a file which configures the transformers appropriately; `transformers.js`:
```
import { transformers } from 'link-lib';

const PRIO_MAX = 1.0;
const PRIO_HIGH = 0.8;

export default {
  transformers: [
    {
      transformer: transformers.jsonapi,
      mediaTypes: 'application/vnd.api+json',
      acceptValue: PRIO_MAX,
    },
    {
      transformer: transformers.rdfFormatsCommon,
      mediaTypes: mediaTypes,
      acceptValue: PRIO_HIGH,
    },
    rdfxml
  ]
};

```

Notice that the transformers are in a separate file that is included twice, this is done so that the
transformer code is reachable within the worker as well as the main code. When you do not need to
support old browsers (IE9/AB<=4.3) this file can be discarded by integrating it directly into the
DataWorker file (saving a Kb's).

### Included namespace prefixes

See the LinkedRenderStore for the namespaces included by default.

# Contributing

The usual stuff. Open an issue to discuss a change, open pull requests directly for bugfixes and refactors.
