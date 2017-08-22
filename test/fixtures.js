import rdf from 'rdflib';

import LinkedRenderStore from '../src/LinkedRenderStore';
import { defaultNS } from '../src/utilities';
import { generateContext } from './utilities';

export const exNS = rdf.Namespace('http://example.org/');
const { owl, schema } = defaultNS;

const context = (iri, lrs, store) => generateContext({
  linkedRenderStore: lrs || true,
  subject: iri,
  store: store || false,
});

const typeObject = (id) => [
  new rdf.Statement(exNS(id), defaultNS.rdf('type'), schema('CreativeWork')),
];

const sTitle = (id, title) => [
  new rdf.Statement(exNS(id), schema('name'), new rdf.Literal(title)),
];

const sFull = (id, attrs) => {
  const iri = exNS(id);
  return [
    typeObject(id)[0],
    new rdf.Statement(iri, schema('name'), new rdf.Literal(attrs.title || 'title')),
    new rdf.Statement(iri, schema('text'), new rdf.Literal(attrs.text || 'text')),
    new rdf.Statement(iri, schema('author'), new rdf.NamedNode(attrs.author || 'http://example.org/people/0')),
  ];
};

function chargeLRS(id, obj, store) {
  const lrs = Object.assign({}, LinkedRenderStore);
  lrs.reset();
  lrs.store.add(obj);
  return context(exNS(id), lrs, store);
}

export const empty = (id = '0', store = false) => chargeLRS(id, [], store);

export const type = (id = '1', store = false) => chargeLRS(id, typeObject(id), store);

export const name = (id = '2', title, store = false) => chargeLRS(
  id,
  typeObject(id).concat(sTitle(id, title)),
  store
);

export const fullCW = (id = '3', attrs = {}, store = false) => chargeLRS(
  id,
  sFull(id, attrs),
  store
);

export const multipleCW = (id = '3', attrs = {}, store = false) => {
  const opts = chargeLRS(id, sFull(id, attrs), store);
  const second = attrs.second || { id: '4' };
  opts.context.linkedRenderStore.store.add(sFull(second.id, second));
  return opts;
};

export const sameRel = (id = '5', attrs = {}, store = false) => {
  const iri = exNS(id);
  const second = attrs.second || { id: `${id}234` };
  const iri2 = exNS(second.id);
  const obj = [
    typeObject(id)[0],
    new rdf.Statement(iri, schema('text'), new rdf.Literal(attrs.text || 'text')),
    new rdf.Statement(iri, schema('author'), new rdf.NamedNode(attrs.author || 'http://example.org/people/0')),

    typeObject(iri2)[0],
    new rdf.Statement(iri2, schema('name'), new rdf.Literal(second.title || 'title')),

    new rdf.Statement(iri2, owl('sameAs'), iri),
  ];
  return chargeLRS(id, obj, store);
};
