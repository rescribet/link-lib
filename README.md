# Link Library
*A Link to the Web*

### [Reference](https://github.com/rescribet/link-redux/wiki): How to use Link with React

[![CircleCI](https://img.shields.io/circleci/build/gh/rescribet/link-lib)](https://circleci.com/gh/rescribet/link-lib)
![Code Climate coverage](https://img.shields.io/codeclimate/coverage/rescribet/link-lib)

This package aims to make building rich web applications quick and easy by providing all the tools
needed to work with linked data, providing high-level API's for view rendering, data querying
& manipulation, and API communication. See the [link-redux](https://github.com/rescribet/link-redux) package on how to
use this in a React project.

To transform your Rails application into a linked-data serving beast, see our
[Active Model Serializers plugin](https://github.com/argu-co/rdf-serializers).

This was built at [Argu](https://argu.co), if you like what we do, these technologies
or open data, send us [a mail](mailto:info@argu.co).

## Example
See the [TODO app](https://rescribet.github.io/link-redux-todo/#/) for a live example and
[link-redux-todo](https://github.com/rescribet/link-redux-todo) for the implementation. Mind that it isn't connected to
a back-end, so it's only a demo for the view rendering mechanism.

## Installation

`yarn add link-lib`

and some peer dependencies:

`yarn add @ontologies/as @ontologies/core @ontologies/schema @ontologies/shacl @ontologies/xsd http-status-codes n-quads-parser`

The package externalizes the Promise API, so make sure to include your own when targeting platforms without native
support.

# Usage

See the [Hypermedia API page](https://github.com/rescribet/link-lib/wiki/Hypermedia-API) for documentation on how to
execute actions against the service.

See [Link Redux](https://github.com/rescribet/link-redux) for documentation on how to use Link in a React application.

### Included namespace prefixes

See the [utilities](https://github.com/rescribet/link-lib/blob/master/src/utilities.ts) for the namespaces included by
default.

# Contributing

The usual stuff. Open an issue to discuss a change, open PR's from topic-branches targeted to master for bugfixes and
refactors.
