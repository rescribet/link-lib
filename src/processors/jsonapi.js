/* eslint no-param-reassign: 0 */
import assert from 'assert';
import rdf from 'rdf-ext';
import { promises as jsonld } from 'jsonld';

import { expandProperty } from '../LinkedRenderStore';

function getIDForEntity(resource, entity) {
  const id = (resource.links && resource.links.self) || entity['@id'];
  return new rdf.NamedNode(id);
}

/**
 * Turns an expanded jsonld object into a graph
 * @returns {rdf.Graph}
 */
function processExpandedEntity(id, expanded, origin) {
  const entity = expanded[0];
  const type = entity['@type'] instanceof Array ? entity['@type'][0] : entity['@type'];
  const graph = new rdf.Graph();

  graph.add(
    new rdf.Quad(
      id,
      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new rdf.NamedNode(type),
      origin,
    ),
  );

  const keys = Object.keys(entity);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] && keys[i][0] === '@') {
      continue;
    }
    const props = entity[keys[i]] instanceof Array ? entity[keys[i]] : [entity[keys[i]]];
    graph.addAll(
      props.map(obj => new rdf.Quad(
        id,
        new rdf.NamedNode(keys[i]),
        obj instanceof Object && obj['@id'] !== undefined ?
          new rdf.NamedNode(obj) : new rdf.Literal(obj),
        origin,
      )),
    );
  }
  return graph;
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
 * @returns {rdf.Graph} RDF representation of the given relation.
 */
function processRelation(relation, topID, origin) {
  const graph = new rdf.Graph();

  const relationID = new rdf.NamedNode(getIDForRelation(relation, relation.data instanceof Array ? 'self' : 'related'));
  if (relationID.toString()) {
    const rel = relation.meta && relation.meta['@type'] || relation.links.self.meta['@type'];
    graph.add(new rdf.Quad(
      topID,
      new rdf.NamedNode(expandProperty(rel)),
      relationID,
      origin,
    ));

    if (relation.data instanceof Array) {
      const member = new rdf.NamedNode(expandProperty('hydra:member'));
      graph.add(new rdf.Quad(
        relationID,
        new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new rdf.NamedNode(expandProperty('hydra:Collection')),
        origin,
      ));
      graph.add(new rdf.Quad(
        topID,
        new rdf.NamedNode(expandProperty('argu:collectionAssociation')),
        relationID,
        origin,
      ));
      relation.data.forEach((rel) => {
        graph.add(new rdf.Quad(relationID, member, new rdf.NamedNode(rel.id), origin));
      });
    }
  }

  if (relation.links instanceof Object) {
    const keys = Object.keys(relation.links);
    for (let i = 0; i < keys.length; i++) {
      const link = relation.links[keys[i]];
      const type = expandProperty(link.meta['@type'] || `schema:${keys[i]}`);
      if (link.href === undefined) {
        continue;
      }
      graph.add(
        new rdf.Quad(
          topID,
          new rdf.NamedNode(type),
          new rdf.NamedNode(link.href),
          origin,
        ),
      );
    }
  }
  return graph;
}

const formatEntity = (resource, next, origin) => {
  assert(resource.attributes, 'object has no attributes');
  const id = getIDForEntity(resource, resource.attributes);
  jsonld
    .expand(resource.attributes)
    .then((expanded) => {
      next(processExpandedEntity(id, expanded, origin));
    });

  if (resource.relationships instanceof Object) {
    const keys = Object.keys(resource.relationships);
    for (let i = 0; i < keys.length; i++) {
      const relation = resource.relationships[keys[i]];
      next(processRelation(relation, id, origin));
    }
  }
};

/**
 * Processes a JSON:API response breaking it up into a named graph.
 * @access public
 * @param {Response|Object} response The response object to process
 * @param {function} next The function to pass the result to.
 * @returns {Promise.<TResult>}
 */
export default function process(response, next) {
  return new Promise((pResolve) => {
    if (typeof response.body !== 'string') {
      pResolve(response.json());
    } else {
      pResolve(JSON.parse(response.body));
    }
  })
  .then((json) => {
    const origin = new URL(response.url).origin;
    formatEntity(json.data, next, origin);
    if (json.included instanceof Array) {
      json.included.map(ent => formatEntity(ent, next, origin));
    }
  });
}
