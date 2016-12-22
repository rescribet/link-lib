import { getContentType } from '../utilities';
const formats = require('rdf-formats-common')();

/**
 * Processes a range of media types with parsers from the
 * [rdf-formats-common package](https://www.npmjs.com/package/rdf-formats-common).
 * @param response
 * @param next
 * @returns {Promise.<TResult>}
 */
export default function process(response, next) {
  return new Promise((pResolve) => {
    if (typeof response.body !== 'string') {
      pResolve(response.text());
    } else {
      pResolve(response.body);
    }
  })
  .then((data) => {
    const format = getContentType(response);
    if (!formats.parsers[format]) {
      throw new Error(`Unknown Format: ${format}`);
    }
    return formats
      .parsers[format]
      .parse(data, undefined, response.url)
      .then(next)
      .catch((e) => {
        throw e;
      });
  });
}
