const fs = require('fs');
const path = require('path');

const schemaFile = fs.readFileSync(path.join(__dirname, './schema.jsonld'));
const schema = JSON.parse(schemaFile);

export default schema;
