# Link Library
*A Link to the Web*

[![Build Status](https://travis-ci.org/fletcher91/link-lib.svg?branch=master)](https://travis-ci.org/fletcher91/link-lib)

This package aims to make building rich web applications quick and easy by providing a wrapper around 
[rdflib.js](https://github.com/linkeddata/rdflib.js)'s store, adding high-level API's for view rendering, data querying
& manipulation, and API communication. See the [link-redux](https://github.com/fletcher91/link-redux) package on how to
use this in a React project.

To transform your Rails application into a linked-data serving beast, see our 
[Active Model Serializers plugin](https://github.com/argu-co/rdf-serializers).

This was built at [Argu](https://argu.co), if you like what we do, these technologies
or open data, send us [a mail](mailto:info@argu.co).

## Example
See the [TODO app](https://fletcher91.github.io/link-redux-todo/#/) for a live example and 
[link-redux-todo](https://github.com/fletcher91/link-redux-todo) for the implementation. Mind that it isn't connected to
a back-end, so it's only a demo for the view rendering mechanism.

## Installation

`npm install link-lib rdflib`

`yarn add link-lib rdflib`

The package externalizes the Promise API, so make sure to include your own when targeting platforms without native
support.

# Usage

Though generality is kept in mind building this library, it places some requirements on the targeted API;

* The API should be a Linked Data serving RESTful API (So it should return some LD format like turtle, nquads, JSON-LD).
* Each IRI SHOULD be a URL. All resources should be fetchable on their own IRI, subresources (#subdoc) or blank nodes 
    should always be included in the resource which mentions them.
    
### Writing Linked Data

In short, Link provides an API to write linked data by calling a resource of type <schema:Action> with a graph as its
optional argument. This is a first implementation, holes in the specification will be filled as the project develops.

### Hypermedia actions

The library exposes the `execActionByIRI` method which can be used to execute [schema:Action](http://schema.org/Action)
resources to write data to a service driven by hypermedia. The schema.org model isn't very specific about how to
actually implement the model so we've done some assumptions as to how the system will work.

Let's say you have a resource about mt. Everest which has a <schema:potentialAction> to some <schema:CreateAction> with
an associated entry point which you want to add a new image to.

```text/turtle
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
 
<https://example.org/location/everest/pictures/create>
  rdf:type schema:CreateAction ;
  schema:name "Upload a picture of Mt. Everest!" ;
  schema:object <https://example.org/location/everest> ;
  schema:result schema:ImageObject ;
  schema:target  <https://example.org/location/everest/pictures/create#entrypoint>.

<https://example.org/location/everest/pictures/create#entrypoint>
  rdf:type schema:EntryPoint ;
  schema:httpMethod "POST" ;
  schema:url <https://example.org/location/everest/pictures> ;
  schema:image <http://fontawesome.io/icon/plus> ;
  schema:name "Add picture" .
```

The difference between the action and the entry point is somewhat arbitrary, but basically the action describes what
happens and the entry point how it should happen.

We diverge a little from schema here by using <schema:url> over <schema:urlTemplate> since schema doesn't specify how to
fill the template (the google examples don't  even use a template, but a plain string, so let's just use <schema:url>).

#### Setting up the request

The only part missing (for non-trivial requests) is the actual body. The graph is created from a plain JS object passed
to the function (call the low-level function in `LinkedDataAPI` directly to pass a custom graph). How to resolve the 
appropriate fields in the object is currently unspecified.

So lets execute our function with an object with an attached file;

```javascript
const lrs = new LinkedRenderStore();
const action = defaultNS.ex('location/everest/pictures/create')

/**
* See [DataToGraph](https://github.com/fletcher91/link-lib/blob/master/src/processor/DataToGraph.ts) for the conversion
* logic.
*/
const data = {
  'http://schema.org/name': 'My everest picture',
  'schema:contentUrl': new File(),                 // Reference to a File instance from some html file input
  'schema:dateCreated': new Date(),                // Most native types should be converted to proper rdf literals
  'schema:author': {                               // Nested resources can be added, they are included with blank nodes.
    'rdf:type': defaultNS.schema('Person'),
    'schema:name': 'D. Engelbart',
  }
}
```

The key names for the data object are processed by
[LinkedRenderStore#expandProperty](https://fletcher91.github.io/link-lib/classes/linkedrenderstore.html#expandproperty),
so it is very lenient with resolving the input to NamedNode's.

#### Executing the request

Now that we have a request description and the appropriate graph, we can tell the LRS to execute the request;

```es6
result = await lrs.execActionByIRI(action, data)
 
// The data is already in the store at this point, but it is included for additional processing.
console.log(`Created new resource with iri ${result.iri} and statements ${result.data.join()}`)
```

By now, if the request was successful, the picture has been uploaded to the service (and probably added to the
collection) visible for all. The IRI of the created resource will be retrieved from the Location header. Normally, the
client implements some post-request processing in order to update the client state to e.g. redirect to the parent
resource and display the created picture. Further information about state-changes are be described in the chapter below.

We currently use a multipart form body to fulfill non-GET requests, where the main resource is marked as
<ll:targetResource>* and additional attached files have some other IRI** (currently <ll:blobs/[random-21-char-string]>).

\* Subject to change to the base URI to conform to LDP.

\** Blank nodes can't be used since we need to refer to the item in the form-data, but the parser may rename
  blank nodes server-side creating a mismatch
  
#### State changes

Generally, the current paradigm is to program logic on what to do after some request is done, based on the status code
and the body (display a message, redirect the user, update counters, etc.). Though this is supported with 
`execActionByIRI`, it is somewhat of an anti-pattern to duplicate such logic or to [change the language of the
back-end](https://en.wikipedia.org/wiki/Isomorphic_JavaScript) to share code.

Link has a somewhat different approach to updating the client-side state. By viewing the back-end service as a basic
state-machine and the client application as a reflection of the application state, the back-end in essence can be viewed
as a function with some side-effects. We place a constraint on the server that it SHOULD send back the side-effects it
created in order to fulfill the request, the front-end can then process those side-effects causing the client to be in
sync with the server again.

So in short, the server should send a delta of the server state before and after the request was processed. The default
behaviour is to add all the statements returned by the server, so if a resource was created, its triples should be sent
back to the client. When data was changed or deleted*, the statements should be contained in a named graph to indicate to
the client that the matching statements should be removed (<ll:remove>).

Back to our example, the server will probably return the new resource and some information about the collection it was
added to;

```
HTTP/1.1 201 CREATED
Location: https://example.org/pictures/203165
Content-Type: application/trig

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix ex: <http://example.org/ns#> .

{
    <https://example.org/pictures/203165>
      rdf:type schema:MediaObject ;
      schema:name "My everest picture" ;
      schema:dateCreated "Thu, 12 Jun 1996 18:26:59 GMT" ;
      schema:dateUploaded "Thu, 1 Mar 2006 20:64:32 GMT" ;
      schema:author <https://example.org/people/584329> ;
      schema:contentUrl <https://static.example.org/pictures/203165.jpeg> ;
      schema:isPartOf <https://example.org/location/everest/pictures> ; // Really stretching the definition here..
      schema:thumbnailUrl <https://static.example.org/pictures/203165_thumb.png> .

    <https://example.org/location/everest/pictures>
      hydra:totalItems 42 .

    <https://example.org/people/584329>
      rdf:type schema:Person ;
      schema:name "D. Engelbart" .
      ex:pictures <https://example.org/people/584329/pictures> .
}

<http://purl.org/link-lib/remove> {
    <https://example.org/location/everest/pictures>
      hydra:totalItems 41 .
}
```

\* The API to describe updates to data isn't stable yet, since the current version requires the server to know which
value the object of the client store was (or make some assumptions like `count - 1` or the previous stored value) which
doesn't scale. Later specifications will probably make use of the PUT v PATCH semantics and more advanced bindings to
the underlying RDF store so we can process the statements of a response before they are added to the store by the
response parsers.

### Included namespace prefixes

See the [utilities](https://github.com/fletcher91/link-lib/blob/master/src/utilities.ts) for the namespaces included by
default.

### Changes to rdflib.js
This library instantiates rdflib.js for some core tasks (low-level querying, processing), but also makes some changes to
its inner workings. See the [RDFStore](https://github.com/fletcher91/link-lib/blob/master/src/RDFStore.ts) for the main
wrapper and [DataProcessor](https://github.com/fletcher91/link-lib/blob/master/src/processor/DataProcessor.ts) for
changes to the rdflib Fetcher.

Following are some of the most important changes;

* All named nodes MUST be instantiated via the memoization mechanism 
([see the utilities](https://github.com/fletcher91/link-lib/blob/master/src/utilities.ts)). This is done to enable the 
use of nested number arrays over string (iri) maps for performance gains.
* To be able to keep track of changes, principles of immutability should be maintained, it is assumed that changes are
either server provided or done via well-documented API's. Return values from the store might be frozen, and making
changes directly will result in unexpected behaviour.
* Some additional work is done to make the return values from rdflib more consistent (e.g. returning empty arrays over
null or undefined).

# Contributing

The usual stuff. Open an issue to discuss a change, open PR's from topic-branches targeted to master for bugfixes and
refactors.
