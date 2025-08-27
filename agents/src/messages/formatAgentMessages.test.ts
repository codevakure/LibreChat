import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { TPayload } from '@/types';
import { formatAgentMessages } from './format';
import { ContentTypes } from '@/common';

describe('formatAgentMessages', () => {
  it('should format simple user and AI messages', () => {
    const payload: TPayload = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
  });

  it('should handle system messages', () => {
    const payload = [
      { role: 'system', content: 'You are a helpful assistant.' },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(SystemMessage);
  });

  it('should format messages with content arrays', () => {
    const payload = [
      {
        role: 'user',
        content: [{ type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Hello' }],
      },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
  });

  it('should handle tool calls and create ToolMessages', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Let me check that for you.',
            tool_call_ids: ['123'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: '123',
              name: 'search',
              args: '{"query":"weather"}',
              output: 'The weather is sunny.',
            },
          },
        ],
      },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[1]).toBeInstanceOf(ToolMessage);
    expect((result.messages[0] as AIMessage).tool_calls).toHaveLength(1);
    expect((result.messages[1] as ToolMessage).tool_call_id).toBe('123');
  });

  it('should handle multiple content parts in assistant messages', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Part 1' },
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Part 2' },
        ],
      },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[0].content).toHaveLength(2);
  });

  it('should heal invalid tool call structure by creating a preceding AIMessage', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: '123',
              name: 'search',
              args: '{"query":"weather"}',
              output: 'The weather is sunny.',
            },
          },
        ],
      },
    ];
    const result = formatAgentMessages(payload);

    // Should have 2 messages: an AIMessage and a ToolMessage
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[1]).toBeInstanceOf(ToolMessage);

    // The AIMessage should have an empty content and the tool_call
    expect(result.messages[0].content).toBe('');
    expect((result.messages[0] as AIMessage).tool_calls).toHaveLength(1);
    expect((result.messages[0] as AIMessage).tool_calls?.[0]).toEqual({
      id: '123',
      name: 'search',
      args: { query: 'weather' },
    });

    // The ToolMessage should have the correct properties
    expect((result.messages[1] as ToolMessage).tool_call_id).toBe('123');
    expect(result.messages[1].name).toBe('search');
    expect(result.messages[1].content).toBe('The weather is sunny.');
  });

  it('should handle tool calls with non-JSON args', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Checking...',
            tool_call_ids: ['123'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: '123',
              name: 'search',
              args: 'non-json-string',
              output: 'Result',
            },
          },
        ],
      },
    ];
    const result = formatAgentMessages(payload);
    expect(result.messages).toHaveLength(2);
    expect(
      (result.messages[0] as AIMessage).tool_calls?.[0].args
    ).toStrictEqual({ input: 'non-json-string' });
  });

  it('should handle complex tool calls with multiple steps', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'I\'ll search for that information.',
            tool_call_ids: ['search_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'search_1',
              name: 'search',
              args: '{"query":"weather in New York"}',
              output:
                'The weather in New York is currently sunny with a temperature of 75°F.',
            },
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Now, I\'ll convert the temperature.',
            tool_call_ids: ['convert_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'convert_1',
              name: 'convert_temperature',
              args: '{"temperature": 75, "from": "F", "to": "C"}',
              output: '23.89°C',
            },
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Here\'s your answer.',
          },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    expect(result.messages).toHaveLength(5);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[1]).toBeInstanceOf(ToolMessage);
    expect(result.messages[2]).toBeInstanceOf(AIMessage);
    expect(result.messages[3]).toBeInstanceOf(ToolMessage);
    expect(result.messages[4]).toBeInstanceOf(AIMessage);

    // Check first AIMessage
    expect(result.messages[0].content).toBe(
      'I\'ll search for that information.'
    );
    expect((result.messages[0] as AIMessage).tool_calls).toHaveLength(1);
    expect((result.messages[0] as AIMessage).tool_calls?.[0]).toEqual({
      id: 'search_1',
      name: 'search',
      args: { query: 'weather in New York' },
    });

    // Check first ToolMessage
    expect((result.messages[1] as ToolMessage).tool_call_id).toBe('search_1');
    expect(result.messages[1].name).toBe('search');
    expect(result.messages[1].content).toBe(
      'The weather in New York is currently sunny with a temperature of 75°F.'
    );

    // Check second AIMessage
    expect(result.messages[2].content).toBe(
      'Now, I\'ll convert the temperature.'
    );
    expect((result.messages[2] as AIMessage).tool_calls).toHaveLength(1);
    expect((result.messages[2] as AIMessage).tool_calls?.[0]).toEqual({
      id: 'convert_1',
      name: 'convert_temperature',
      args: { temperature: 75, from: 'F', to: 'C' },
    });

    // Check second ToolMessage
    expect((result.messages[3] as ToolMessage).tool_call_id).toBe('convert_1');
    expect(result.messages[3].name).toBe('convert_temperature');
    expect(result.messages[3].content).toBe('23.89°C');

    // Check final AIMessage
    expect(result.messages[4].content).toStrictEqual([
      { [ContentTypes.TEXT]: 'Here\'s your answer.', type: ContentTypes.TEXT },
    ]);
  });

  it.skip('should not produce two consecutive assistant messages and format content correctly', () => {
    const payload = [
      { role: 'user', content: 'Hello' },
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Hi there!' },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'How can I help you?',
          },
        ],
      },
      { role: 'user', content: 'What\'s the weather?' },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Let me check that for you.',
            tool_call_ids: ['weather_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'weather_1',
              name: 'check_weather',
              args: '{"location":"New York"}',
              output: 'Sunny, 75°F',
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Here\'s the weather information.',
          },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    // Check correct message count and types
    expect(result.messages).toHaveLength(6);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
    expect(result.messages[2]).toBeInstanceOf(HumanMessage);
    expect(result.messages[3]).toBeInstanceOf(AIMessage);
    expect(result.messages[4]).toBeInstanceOf(ToolMessage);
    expect(result.messages[5]).toBeInstanceOf(AIMessage);

    // Check content of messages
    expect(result.messages[0].content).toStrictEqual([
      { [ContentTypes.TEXT]: 'Hello', type: ContentTypes.TEXT },
    ]);
    expect(result.messages[1].content).toStrictEqual([
      { [ContentTypes.TEXT]: 'Hi there!', type: ContentTypes.TEXT },
      { [ContentTypes.TEXT]: 'How can I help you?', type: ContentTypes.TEXT },
    ]);
    expect(result.messages[2].content).toStrictEqual([
      { [ContentTypes.TEXT]: 'What\'s the weather?', type: ContentTypes.TEXT },
    ]);
    expect(result.messages[3].content).toBe('Let me check that for you.');
    expect(result.messages[4].content).toBe('Sunny, 75°F');
    expect(result.messages[5].content).toStrictEqual([
      {
        [ContentTypes.TEXT]: 'Here\'s the weather information.',
        type: ContentTypes.TEXT,
      },
    ]);

    // Check that there are no consecutive AIMessages
    const messageTypes = result.messages.map((message) => message.constructor);
    for (let i = 0; i < messageTypes.length - 1; i++) {
      expect(
        messageTypes[i] === AIMessage && messageTypes[i + 1] === AIMessage
      ).toBe(false);
    }

    // Additional check to ensure the consecutive assistant messages were combined
    expect(result.messages[1].content).toHaveLength(2);
  });

  it('should skip THINK type content parts', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Initial response' },
          {
            type: ContentTypes.THINK,
            [ContentTypes.THINK]: 'Reasoning about the problem...',
          },
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Final answer' },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[0].content).toEqual(
      'Initial response\nFinal answer'
    );
  });

  it('should join TEXT content as string when THINK content type is present', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.THINK,
            [ContentTypes.THINK]: 'Analyzing the problem...',
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'First part of response',
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Second part of response',
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Final part of response',
          },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(typeof result.messages[0].content).toBe('string');
    expect(result.messages[0].content).toBe(
      'First part of response\nSecond part of response\nFinal part of response'
    );
    expect(result.messages[0].content).not.toContain(
      'Analyzing the problem...'
    );
  });

  it('should exclude ERROR type content parts', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Hello there' },
          {
            type: ContentTypes.ERROR,
            [ContentTypes.ERROR]:
              'An error occurred while processing the request: Something went wrong',
          },
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Final answer' },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[0].content).toEqual([
      { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Hello there' },
      { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Final answer' },
    ]);

    const hasErrorContent =
      Array.isArray(result.messages[0].content) &&
      result.messages[0].content.some(
        (item) =>
          item.type === ContentTypes.ERROR ||
          JSON.stringify(item).includes('An error occurred')
      );
    expect(hasErrorContent).toBe(false);
  });
  it('should handle indexTokenCountMap and return updated map', () => {
    const payload = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const indexTokenCountMap = {
      0: 5, // 5 tokens for "Hello"
      1: 10, // 10 tokens for "Hi there!"
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    expect(result.messages).toHaveLength(2);
    expect(result.indexTokenCountMap).toBeDefined();
    expect(result.indexTokenCountMap?.[0]).toBe(5);
    expect(result.indexTokenCountMap?.[1]).toBe(10);
  });

  it('should handle complex message transformations with indexTokenCountMap', () => {
    const payload = [
      { role: 'user', content: 'What\'s the weather?' },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Let me check that for you.',
            tool_call_ids: ['weather_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'weather_1',
              name: 'check_weather',
              args: '{"location":"New York"}',
              output: 'Sunny, 75°F',
            },
          },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 10, // 10 tokens for "What's the weather?"
      1: 50, // 50 tokens for the assistant message with tool call
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // The original message at index 1 should be split into two messages
    expect(result.messages).toHaveLength(3);
    expect(result.indexTokenCountMap).toBeDefined();
    expect(result.indexTokenCountMap?.[0]).toBe(10); // User message stays the same

    // The assistant message tokens should be distributed across the resulting messages
    const totalAssistantTokens =
      Object.values(result.indexTokenCountMap || {}).reduce(
        (sum, count) => sum + count,
        0
      ) - 10; // Subtract user message tokens

    expect(totalAssistantTokens).toBe(50); // Should match the original token count
  });

  it('should handle one-to-many message expansion with tool calls', () => {
    // One message with multiple tool calls expands to multiple messages
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'First tool call:',
            tool_call_ids: ['tool_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_1',
              name: 'search',
              args: '{"query":"test"}',
              output: 'Search result',
            },
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Second tool call:',
            tool_call_ids: ['tool_2'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_2',
              name: 'calculate',
              args: '{"expression":"1+1"}',
              output: '2',
            },
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'Final response',
          },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 100, // 100 tokens for the complex assistant message
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // One message expands to 5 messages (2 tool calls + text before, between, and after)
    expect(result.messages).toHaveLength(5);
    expect(result.indexTokenCountMap).toBeDefined();

    // The sum of all token counts should equal the original
    const totalTokens = Object.values(result.indexTokenCountMap || {}).reduce(
      (sum, count) => sum + count,
      0
    );

    expect(totalTokens).toBe(100);

    // Check that each resulting message has a token count
    for (let i = 0; i < result.messages.length; i++) {
      expect(result.indexTokenCountMap?.[i]).toBeDefined();
    }
  });

  it('should handle content filtering that reduces message count', () => {
    // Message with THINK and ERROR parts that get filtered out
    const payload = [
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.THINK, [ContentTypes.THINK]: 'Thinking...' },
          { type: ContentTypes.TEXT, [ContentTypes.TEXT]: 'Visible response' },
          { type: ContentTypes.ERROR, [ContentTypes.ERROR]: 'Error occurred' },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 60, // 60 tokens for the message with filtered content
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // Only one message should remain after filtering
    expect(result.messages).toHaveLength(1);
    expect(result.indexTokenCountMap).toBeDefined();

    // All tokens should be assigned to the remaining message
    expect(result.indexTokenCountMap?.[0]).toBe(60);
  });

  it('should handle empty result after content filtering', () => {
    // Message with only THINK and ERROR parts that all get filtered out
    const payload = [
      {
        role: 'assistant',
        content: [
          { type: ContentTypes.THINK, [ContentTypes.THINK]: 'Thinking...' },
          { type: ContentTypes.ERROR, [ContentTypes.ERROR]: 'Error occurred' },
          { type: ContentTypes.AGENT_UPDATE, update: 'Processing...' },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 40, // 40 tokens for the message with filtered content
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // No messages should remain after filtering
    expect(result.messages).toHaveLength(0);
    expect(result.indexTokenCountMap).toBeDefined();

    // The token count map should be empty since there are no messages
    expect(Object.keys(result.indexTokenCountMap || {})).toHaveLength(0);
  });

  it('should demonstrate how 2 input messages can become more than 2 output messages', () => {
    // Two input messages where one contains tool calls
    const payload = [
      { role: 'user', content: 'Can you help me with something?' },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'I\'ll help you with that.',
            tool_call_ids: ['tool_1'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_1',
              name: 'search',
              args: '{"query":"help topics"}',
              output: 'Found several help topics.',
            },
          },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 15, // 15 tokens for the user message
      1: 45, // 45 tokens for the assistant message with tool call
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // 2 input messages become 3 output messages (user + assistant + tool)
    expect(payload).toHaveLength(2);
    expect(result.messages).toHaveLength(3);
    expect(result.indexTokenCountMap).toBeDefined();
    expect(Object.keys(result.indexTokenCountMap ?? {}).length).toBe(3);

    // Check message types
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
    expect(result.messages[2]).toBeInstanceOf(ToolMessage);

    // The sum of all token counts should equal the original total
    const totalTokens = Object.values(result.indexTokenCountMap || {}).reduce(
      (sum, count) => sum + count,
      0
    );

    expect(totalTokens).toBe(60); // 15 + 45
  });

  it('should handle an AI message with 5 tool calls in a single message', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]: 'I\'ll perform multiple operations for you.',
            tool_call_ids: ['tool_1', 'tool_2', 'tool_3', 'tool_4', 'tool_5'],
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_1',
              name: 'search',
              args: '{"query":"latest news"}',
              output: 'Found several news articles.',
            },
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_2',
              name: 'check_weather',
              args: '{"location":"New York"}',
              output: 'Sunny, 75°F',
            },
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_3',
              name: 'calculate',
              args: '{"expression":"356 * 24"}',
              output: '8544',
            },
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_4',
              name: 'translate',
              args: '{"text":"Hello world","source":"en","target":"fr"}',
              output: 'Bonjour le monde',
            },
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tool_5',
              name: 'fetch_data',
              args: '{"endpoint":"/api/users","params":{"limit":5}}',
              output:
                '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"},{"id":3,"name":"Charlie"},{"id":4,"name":"David"},{"id":5,"name":"Eve"}]}',
            },
          },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    // Should have 6 messages: 1 AIMessage and 5 ToolMessages
    expect(result.messages).toHaveLength(6);

    // Check message types in the correct sequence
    expect(result.messages[0]).toBeInstanceOf(AIMessage); // Initial message with all tool calls
    expect(result.messages[1]).toBeInstanceOf(ToolMessage); // Tool 1 response
    expect(result.messages[2]).toBeInstanceOf(ToolMessage); // Tool 2 response
    expect(result.messages[3]).toBeInstanceOf(ToolMessage); // Tool 3 response
    expect(result.messages[4]).toBeInstanceOf(ToolMessage); // Tool 4 response
    expect(result.messages[5]).toBeInstanceOf(ToolMessage); // Tool 5 response

    // Check AIMessage has all 5 tool calls
    expect(result.messages[0].content).toBe(
      'I\'ll perform multiple operations for you.'
    );
    expect((result.messages[0] as AIMessage).tool_calls).toHaveLength(5);

    // Verify each tool call in the AIMessage
    expect((result.messages[0] as AIMessage).tool_calls?.[0]).toEqual({
      id: 'tool_1',
      name: 'search',
      args: { query: 'latest news' },
    });

    expect((result.messages[0] as AIMessage).tool_calls?.[1]).toEqual({
      id: 'tool_2',
      name: 'check_weather',
      args: { location: 'New York' },
    });

    expect((result.messages[0] as AIMessage).tool_calls?.[2]).toEqual({
      id: 'tool_3',
      name: 'calculate',
      args: { expression: '356 * 24' },
    });

    expect((result.messages[0] as AIMessage).tool_calls?.[3]).toEqual({
      id: 'tool_4',
      name: 'translate',
      args: { text: 'Hello world', source: 'en', target: 'fr' },
    });

    expect((result.messages[0] as AIMessage).tool_calls?.[4]).toEqual({
      id: 'tool_5',
      name: 'fetch_data',
      args: { endpoint: '/api/users', params: { limit: 5 } },
    });

    // Check each ToolMessage
    expect((result.messages[1] as ToolMessage).tool_call_id).toBe('tool_1');
    expect(result.messages[1].name).toBe('search');
    expect(result.messages[1].content).toBe('Found several news articles.');

    expect((result.messages[2] as ToolMessage).tool_call_id).toBe('tool_2');
    expect(result.messages[2].name).toBe('check_weather');
    expect(result.messages[2].content).toBe('Sunny, 75°F');

    expect((result.messages[3] as ToolMessage).tool_call_id).toBe('tool_3');
    expect(result.messages[3].name).toBe('calculate');
    expect(result.messages[3].content).toBe('8544');

    expect((result.messages[4] as ToolMessage).tool_call_id).toBe('tool_4');
    expect(result.messages[4].name).toBe('translate');
    expect(result.messages[4].content).toBe('Bonjour le monde');

    expect((result.messages[5] as ToolMessage).tool_call_id).toBe('tool_5');
    expect(result.messages[5].name).toBe('fetch_data');
    expect(result.messages[5].content).toBe(
      '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"},{"id":3,"name":"Charlie"},{"id":4,"name":"David"},{"id":5,"name":"Eve"}]}'
    );
  });

  it('should heal tool call structure with thinking content', () => {
    const payload = [
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.THINK,
            [ContentTypes.THINK]:
              'I\'ll add this agreement as an observation to our existing troubleshooting task in the project memory system.',
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: {
              id: 'tooluse_Zz-mw_wHTrWTvDHaCbfaZg',
              name: 'add_observations_mcp_project-memory',
              args: '{"observations":[{"entityName":"MCP_Tool_Error_Troubleshooting","contents":["Agreement established: Document all future tests in the project memory system to maintain a comprehensive troubleshooting log","This will provide a structured record of the entire troubleshooting process and help identify patterns in the error behavior"]}]}',
              type: 'tool_call',
              progress: 1,
              output:
                '[\n  {\n    "entityName": "MCP_Tool_Error_Troubleshooting",\n    "addedObservations": [\n      {\n        "content": "Agreement established: Document all future tests in the project memory system to maintain a comprehensive troubleshooting log",\n        "timestamp": "2025-03-26T00:46:42.154Z"\n      },\n      {\n        "content": "This will provide a structured record of the entire troubleshooting process and help identify patterns in the error behavior",\n        "timestamp": "2025-03-26T00:46:42.154Z"\n      }\n    ]\n  }\n]',
            },
          },
          {
            type: ContentTypes.TEXT,
            [ContentTypes.TEXT]:
              '\n\nI\'ve successfully added our agreement to the project memory system. The observation has been recorded in the "MCP_Tool_Error_Troubleshooting" entity with the current timestamp.\n\nGoing forward, I will:\n\n1. Document each test we perform\n2. Record the methodology and results\n3. Update the project memory with our findings\n4. Establish appropriate relationships between tests and related components\n5. Provide a summary of what we\'ve learned from each test\n\nThis structured approach will help us build a comprehensive knowledge base of the error behavior and our troubleshooting process, which may prove valuable for resolving similar issues in the future or for other developers facing similar challenges.\n\nWhat test would you like to perform next in our troubleshooting process?',
          },
        ],
      },
    ];

    const result = formatAgentMessages(payload);

    // Should have 3 messages: an AIMessage with empty content, a ToolMessage, and a final AIMessage with the text
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
    expect(result.messages[1]).toBeInstanceOf(ToolMessage);
    expect(result.messages[2]).toBeInstanceOf(AIMessage);

    // The first AIMessage should have an empty content and the tool_call
    expect(result.messages[0].content).toBe('');
    expect((result.messages[0] as AIMessage).tool_calls).toHaveLength(1);
    expect((result.messages[0] as AIMessage).tool_calls?.[0].name).toBe(
      'add_observations_mcp_project-memory'
    );

    // The ToolMessage should have the correct properties
    expect((result.messages[1] as ToolMessage).tool_call_id).toBe(
      'tooluse_Zz-mw_wHTrWTvDHaCbfaZg'
    );
    expect(result.messages[1].name).toBe('add_observations_mcp_project-memory');
    expect(result.messages[1].content).toContain(
      'MCP_Tool_Error_Troubleshooting'
    );

    // The final AIMessage should contain the text response
    expect(typeof result.messages[2].content).toBe('string');
    expect((result.messages[2].content as string).trim()).toContain(
      'I\'ve successfully added our agreement to the project memory system'
    );
  });

  it('should demonstrate how messages can be filtered out, reducing count', () => {
    // Two input messages where one gets completely filtered out
    const payload = [
      { role: 'user', content: 'Hello there' },
      {
        role: 'assistant',
        content: [
          {
            type: ContentTypes.THINK,
            [ContentTypes.THINK]: 'Thinking about response...',
          },
          {
            type: ContentTypes.ERROR,
            [ContentTypes.ERROR]: 'Error in processing',
          },
          { type: ContentTypes.AGENT_UPDATE, update: 'Working on it...' },
        ],
      },
    ];

    const indexTokenCountMap = {
      0: 10, // 10 tokens for the user message
      1: 30, // 30 tokens for the assistant message that will be filtered out
    };

    const result = formatAgentMessages(payload, indexTokenCountMap);

    // 2 input messages become 1 output message (only the user message remains)
    expect(payload).toHaveLength(2);
    expect(result.messages).toHaveLength(1);
    expect(result.indexTokenCountMap).toBeDefined();
    expect(Object.keys(result.indexTokenCountMap ?? {}).length).toBe(1);

    // Check message type
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);

    // Only the user message tokens should remain
    expect(result.indexTokenCountMap?.[0]).toBe(10);

    // The total tokens should be just the user message tokens
    const totalTokens = Object.values(result.indexTokenCountMap || {}).reduce(
      (sum, count) => sum + count,
      0
    );

    expect(totalTokens).toBe(10);
  });
});
