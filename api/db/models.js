const mongoose = require('mongoose');
const { createModels } = require('@wrangler/data-schemas');
const models = createModels(mongoose);

module.exports = { ...models };
