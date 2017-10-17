import rdf from 'rdflib';

import { getContentType } from '../utilities';

/**
 * Processes a range of media types with parsers from the
 * [rdf-formats-common package](https://www.npmjs.com/package/rdf-formats-common).
 * @param response
 * @returns {Promise.<TResult>}
 */
export default function process(response) {
  return new Promise((pResolve) => {
    if (typeof response.responseText === 'string') {
      pResolve(response.responseText);
    } else if (typeof response.body !== 'string') {
      pResolve(response.text());
    } else {
      pResolve(response.body);
    }
  })
    .then((data) => {
      const format = getContentType(response);
      const g = rdf.graph();
      rdf.parse(data, g, response.responseURL || response.url, format);
      return g.statements;
    })
    .catch((e) => {
      throw e;
    });
}
