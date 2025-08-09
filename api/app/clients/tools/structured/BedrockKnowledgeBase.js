const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { logger } = require('~/config');
const AWS_ERROR_MESSAGES = {
  AccessDeniedException: 'Access denied to the AWS Bedrock Knowledge Base. Make sure your AWS credentials have the "bedrock:Retrieve" permission for this knowledge base ID.',
  ResourceNotFoundException: 'The specified knowledge base ID was not found. Please verify the knowledge base ID is correct.',
  ValidationException: 'Invalid request parameters. Please check your query and try again.',
  ThrottlingException: 'Request throttled by AWS Bedrock. Please try again later.',
  UnrecognizedClientException: 'The security token included in the request is invalid or has expired. Please check your AWS credentials.',
};

/**
 * Tool for AWS Bedrock Knowledge Base retrieval.
 * Allows agents to search and retrieve information from configured AWS Bedrock Knowledge Bases.
 */
class BedrockKnowledgeBase extends Tool {
  // Constants for default values
  static DEFAULT_API_VERSION = '2023-09-30';
  static DEFAULT_MAX_RESULTS = 5;
  static DEFAULT_REGION = 'us-east-1';

  // Helper function for initializing properties
  _initializeField(field, envVar, defaultValue) {
    return field || process.env[envVar] || defaultValue;
  }

  constructor(fields = {}) {
    super();
    this.name = 'bedrock-knowledge-base';
    this.description = 
      'Search and retrieve information from AWS Bedrock Knowledge Base using natural language queries. ' +
      'This tool provides access to your organization\'s knowledge base for accurate, context-aware information retrieval.';
    
    /* Used to initialize the Tool without necessary variables. */
    this.override = fields.override ?? false;

    // Define schema for the tool input
    this.schema = z.object({
      query: z.string().describe(
        'Natural language search query to find relevant information in the knowledge base. ' +
        'Be specific and include key terms related to the information you\'re looking for.'
      ),
      max_results: z.number().min(1).max(20).optional().describe(
        'Maximum number of results to return (1-20, default: 5)'
      ),
    });

    // IMPORTANT: Get the knowledge base ID from user authentication (passed by loadToolWithAuth)
    // This is the ID provided by the user when they add the tool in the agent builder
    this.knowledgeBaseId = fields.BEDROCK_KNOWLEDGE_BASE_ID;
    
    // Always use the region from the environment variables
    this.region = process.env.BEDROCK_AWS_DEFAULT_REGION || BedrockKnowledgeBase.DEFAULT_REGION;
    
    // Always use AWS credentials from the environment variables
    this.accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
    this.sessionToken = process.env.BEDROCK_AWS_SESSION_TOKEN;
    
    this.maxResults = this._initializeField(
      fields.max_results,
      'BEDROCK_KB_MAX_RESULTS',
      BedrockKnowledgeBase.DEFAULT_MAX_RESULTS,
    );

    // Check for required AWS credentials (use same validation as Bedrock endpoint)
    if (!this.override && (!this.accessKeyId || !this.secretAccessKey)) {
      throw new Error(
        'Missing AWS Bedrock credentials. Please configure BEDROCK_AWS_ACCESS_KEY_ID and ' +
        'BEDROCK_AWS_SECRET_ACCESS_KEY environment variables (same as used for Bedrock endpoint).',
      );
    }

    // Check for knowledge base ID
    if (!this.override && !this.knowledgeBaseId) {
      throw new Error(
        'Missing Bedrock Knowledge Base ID. Please configure the knowledge base ID when adding this tool.',
      );
    }

    if (this.override) {
      return;
    }

    // Create Bedrock Agent Runtime client using existing credentials
    const clientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        ...(this.sessionToken && { sessionToken: this.sessionToken }),
      },
    };

    this.client = new BedrockAgentRuntimeClient(clientConfig);
  }

  /**
   * Execute the knowledge base retrieval
   * @param {Object} data - The input data containing query and optional parameters
   * @returns {Promise<string>} - Formatted search results
   */
  async _call(data) {
    const { query, max_results } = data;
    
    // Use the knowledge base ID configured during tool authentication
    const knowledgeBaseId = this.knowledgeBaseId;
    
    if (!knowledgeBaseId) {
      return 'No knowledge base ID configured. Please ensure the tool is properly configured with a BEDROCK_KNOWLEDGE_BASE_ID.';
    }

    // Log debug info about the credentials and knowledge base
    logger.debug(`[BedrockKnowledgeBase] Using knowledge base ID: ${knowledgeBaseId}`);
    logger.debug(`[BedrockKnowledgeBase] Using region: ${this.region}`);
    logger.debug(`[BedrockKnowledgeBase] AWS credentials available: ${!!this.accessKeyId && !!this.secretAccessKey}`);
    
    try {
      const maxResults = max_results || this.maxResults;
      
      // Prepare the retrieve command
      const command = new RetrieveCommand({
        knowledgeBaseId: knowledgeBaseId,
        retrievalQuery: {
          text: query,
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: typeof maxResults === 'string' ? Number(maxResults) : maxResults,
          },
        },
      });

      logger.debug(`[BedrockKnowledgeBase] Querying knowledge base: ${knowledgeBaseId} with query: "${query}"`);
      
      // Execute the retrieval
      const response = await this.client.send(command);
      
      if (!response.retrievalResults || response.retrievalResults.length === 0) {
        return `No relevant information found in knowledge base ${knowledgeBaseId} for query: "${query}". ` +
               'Try rephrasing your question or using different keywords.';
      }

      // Format the results
      const formattedResults = response.retrievalResults.map((result, index) => {
        const content = result.content?.text || 'No content available';
        const score = result.score ? result.score.toFixed(4) : 'N/A';
        const location = result.location?.s3Location?.uri || 'Unknown source';
        const metadata = result.metadata ? JSON.stringify(result.metadata, null, 2) : 'No metadata';
        
        return `## Result ${index + 1}
**Relevance Score:** ${score}
**Source:** ${location}
**Content:** ${content}
**Metadata:** ${metadata}`;
      });

      const resultText = formattedResults.join('\n\n---\n\n');
      
      logger.debug(`[BedrockKnowledgeBase] Retrieved ${response.retrievalResults.length} results`);
      
      return `# Knowledge Base Search Results

**Query:** "${query}"
**Knowledge Base:** ${knowledgeBaseId}
**Results Found:** ${response.retrievalResults.length}

${resultText}

---
*Results retrieved from AWS Bedrock Knowledge Base*`;

    } catch (error) {
      const errorMessage = `AWS Bedrock Knowledge Base retrieval failed: ${error.message}`;
      logger.error(errorMessage, error);
      
      // Handle 403 errors specifically with more detailed information
      if (error.name === 'AccessDeniedException' || error.message.includes('security_exception') || error.message.includes('403 Forbidden')) {
        logger.error('[BedrockKnowledgeBase] Permission error details:', {
          knowledgeBaseId,
          region: this.region,
          errorName: error.name,
          errorMessage: error.message,
          hasCredentials: !!this.accessKeyId && !!this.secretAccessKey
        });
        
        return `Access denied to the AWS Bedrock Knowledge Base (ID: ${knowledgeBaseId}). 
        
Please verify:
1. The knowledge base ID is correct
2. Your AWS credentials have the "bedrock:Retrieve" permission for this knowledge base ID
3. The knowledge base is in the same region as your credentials (${this.region})
4. The knowledge base service role has proper permissions

For more information, see the AWS documentation: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html`;
      } else if (error.name === 'ResourceNotFoundException') {
        return `The specified knowledge base ID (${knowledgeBaseId}) was not found. Please verify the knowledge base ID is correct.`;
      } else if (error.name === 'ValidationException') {
        return 'Invalid request parameters. Please check your query and try again.';
      } else if (error.name === 'ThrottlingException') {
        return 'Request throttled by AWS Bedrock. Please try again later.';
      } else if (error.message.includes('credentials')) {
        return 'AWS credential error. Please check that BEDROCK_AWS_ACCESS_KEY_ID and BEDROCK_AWS_SECRET_ACCESS_KEY are properly configured.';
      }
      
      return `Error retrieving information from knowledge base (ID: ${knowledgeBaseId}): ${error.message}`;
    }
  }
}

module.exports = BedrockKnowledgeBase;
