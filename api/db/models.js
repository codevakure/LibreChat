const mongoose = require('mongoose');
const { createModels } = require('@pleach/data-schemas');
const models = createModels(mongoose);

module.exports = { ...models };
