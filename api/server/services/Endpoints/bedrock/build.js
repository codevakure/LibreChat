const { removeNullishValues } = require('pleach-data-provider');
const generateArtifactsPrompt = require('~/app/clients/prompts/artifacts');
const generateChartPrompt = require('~/app/clients/prompts/charts');

const buildOptions = (endpoint, parsedBody) => {
  const {
    modelLabel: name,
    promptPrefix,
    maxContextTokens,
    resendFiles = true,
    imageDetail,
    iconURL,
    greeting,
    spec,
    artifacts,
    charts,
    ...model_parameters
  } = parsedBody;
  const endpointOption = removeNullishValues({
    endpoint,
    name,
    resendFiles,
    imageDetail,
    iconURL,
    greeting,
    spec,
    promptPrefix,
    maxContextTokens,
    model_parameters,
  });

  if (typeof artifacts === 'string') {
    endpointOption.artifactsPrompt = generateArtifactsPrompt({ endpoint, artifacts });
  }

  if (charts === true) {
    endpointOption.chartsPrompt = generateChartPrompt();
  }

  return endpointOption;
};

module.exports = { buildOptions };
