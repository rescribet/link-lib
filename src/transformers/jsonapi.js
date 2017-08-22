/* eslint no-param-reassign: 0 */
import { promises as jsonld } from 'jsonld';
import rdf from 'rdflib';
import { URL } from 'universal-url';

import LRS from '../LinkedRenderStore';
import { getValueOrID } from '../utilities';

function getIDForEntity(resource, entity) {
  const id = (resource.links && resource.links.self) || entity['@id'];
  return new rdf.NamedNode(id);
}

/**
 * Turns an expanded jsonld object into a graph
 * @returns {rdf.Graph}
 */
function processExpandedEntity(statements, id, expanded, origin) {
  const entity = expanded[0];
  let type = entity['@type'] || entity['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'];
  if (type instanceof Array) {
    type = type[0];
  }

  statements.push(
    new rdf.Statement(
      id,
      LRS.namespaces.rdf('type'),
      new rdf.NamedNode(type['@value'] || type),
      origin,
    ),
  );

  const keys = Object.keys(entity);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] && keys[i][0] !== '@') {
      const props = entity[keys[i]] instanceof Array ? entity[keys[i]] : [entity[keys[i]]];
      statements.push(
        ...props.map((obj) => {
          let value;
          if (obj instanceof Object && obj['@id'] !== undefined) {
            value = new rdf.NamedNode(obj);
          } else {
            const raw = getValueOrID(obj);
            let datatype;
            switch (typeof raw) {
              case 'boolean':
                datatype = LRS.namespaces.xsd('boolean');
                break;
              default:
                datatype = LRS.namespaces.xsd('string');
            }
            value = new rdf.Literal(raw.toString(), undefined, datatype);
          }
          return new rdf.Statement(
            id,
            new rdf.NamedNode(keys[i]),
            value,
            origin,
          );
        }),
      );
    }
  }
  return statements;
}

function processLinks(statements, entity, topID, origin) {
  if (entity.links instanceof Object) {
    const keys = Object.keys(entity.links);
    for (let i = 0; i < keys.length; i++) {
      const link = entity.links[keys[i]];
      if (typeof link.meta !== 'undefined') {
        const type = LRS.expandProperty(link.meta['@type'] || `schema:${keys[i]}`);
        if (link.href !== undefined && link.href !== null) {
          statements.push(
            new rdf.Statement(
              topID,
              type,
              new rdf.NamedNode(link.href),
              origin,
            ),
          );
        }
      }
    }
  }
}

function getIDForRelation(relation, link = 'self') {
  if (relation.meta && relation.meta['@id']) {
    return relation.meta && relation.meta['@id'];
  }
  const linkObj = relation.links && relation.links[link];
  return linkObj && linkObj instanceof Object ? linkObj.href : linkObj;
}

/**
 * Splits a JSON:API relation into quads.
 * @access private
 * @param {Object} relation An [relationship object](http://jsonapi.org/format/#document-resource-object-relationships)
 * @param topID The ID of the parent object.
 * @param {String} origin The graph to serialize the data into.
 * @returns {Promise} RDF representation of the given relation.
 */
function processRelation(statements, relation, topID, origin) {
  return new Promise((resolve) => {
    const relIDString = getIDForRelation(relation, relation.data instanceof Array ? 'self' : 'related');
    const relationID = relIDString && new rdf.NamedNode(relIDString);
    const relType = (relation.meta && relation.meta['@type']) || (relation.links && relation.links.self.meta['@type']);
    const relTypeTriple = LRS.expandProperty(relType);
    if (typeof relationID !== 'undefined') {
      statements.push(new rdf.Statement(topID, relTypeTriple, relationID, origin));
    }

    if (relation.data instanceof Array) {
      let member;
      if (typeof relationID !== 'undefined') {
        member = LRS.expandProperty('argu:members');
        const type = relation.links.related &&
          relation.links.related.meta &&
          relation.links.related.meta['@type'];
        statements.push(new rdf.Statement(
          relationID,
          new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          LRS.expandProperty(type || 'argu:Collection'),
          origin,
        ));
        statements.push(new rdf.Statement(
          topID,
          LRS.expandProperty('argu:collectionAssociation'),
          relationID,
          origin,
        ));
      }
      const placeOnForeign = !(typeof relationID === 'undefined');
      relation.data.forEach((datum) => {
        const t = placeOnForeign
          ? new rdf.Statement(relationID, member, new rdf.NamedNode(datum.id), origin)
          : new rdf.Statement(topID, relTypeTriple, new rdf.NamedNode(datum.id), origin);
        statements.push(t);
      });
    }

    processLinks(statements, relation, topID, origin);
    resolve();
  });
}

const formatEntity = (statements, resource, origin, objUrl = undefined) => {
  const promises = [];

  if (typeof resource.attributes === 'undefined' || resource.attributes === {}) {
    throw new Error('object has no attributes');
  }
  const id = getIDForEntity(resource, resource.attributes);
  promises.push(
    jsonld
      .expand(resource.attributes)
      .then((expanded) => {
        processExpandedEntity(statements, id, expanded, origin);
        if (objUrl !== undefined && id && objUrl !== id.toString()) {
          statements.push(
            new rdf.Statement(
              new rdf.NamedNode(objUrl),
              new rdf.NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
              id,
              origin,
            ),
          );
        }
        return Promise.resolve();
      }),
  );

  if (resource.relationships instanceof Object) {
    const keys = Object.keys(resource.relationships);
    for (let i = 0; i < keys.length; i++) {
      const relation = resource.relationships[keys[i]];
      promises.push(processRelation(statements, relation, id, origin));
    }
  }
  if (resource.links instanceof Object) {
    processLinks(statements, resource, id, origin);
  }
  return Promise.all(promises).then(() => statements);
};

/**
 * Processes a JSON:API response breaking it up into a named graph.
 * @access public
 * @param {Response|Object} response The response object to process
 * @param {function} next The function to pass the result to.
 */
export default function process(response) {
  return new Promise((pResolve) => {
    if (typeof response.response === 'string') {
      pResolve(JSON.parse(response.response));
    } else if (typeof response.body !== 'string') {
      pResolve(response.json());
    } else {
      pResolve(JSON.parse(response.body));
    }
  })
  .then((json) => {
    const origin = new URL(response.responseURL).origin;
    const promises = [];
    // const graph = rdf.graph();
    const statements = [];
    promises.push(formatEntity(statements, json.data, origin, response.responseURL));
    if (json.included instanceof Array) {
      promises.push(...json.included.map(ent => formatEntity(statements, ent, origin)));
    }
    return Promise
      .all(promises)
      .then(() => statements);
  });
}
