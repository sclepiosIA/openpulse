/**
 * 🚀 Azure GPT-5.2 Responses API - Helper centralisé
 * 
 * Ce helper gère le nouveau format "Responses API" d'Azure OpenAI (2025)
 * utilisé par GPT-5.2, qui diffère de l'API Chat Completions standard.
 * 
 * Différences clés:
 * - `input` au lieu de `messages`
 * - `instructions` au lieu de message system
 * - `max_output_tokens` au lieu de `max_completion_tokens`
 * - `reasoning: { effort }` et `text: { verbosity }` pour les paramètres
 * - `output[]` au lieu de `choices[].message`
 * - Tool calls: `type: "function_call"` dans output
 * - Tool results: `type: "function_call_output"` dans input
 */

// ============================================================
// Types pour l'API Responses
// ============================================================

export interface ResponsesAPIInputItem {
  role?: 'user' | 'assistant' | 'system';
  content?: string | Array<{ type: string; text?: string }>;
  type?: 'function_call_output' | 'message';
  call_id?: string;
  output?: string;
  id?: string;
  name?: string;
  arguments?: string;
}

export interface ResponsesAPIOutputItem {
  type: 'reasoning' | 'message' | 'function_call';
  id?: string;
  // For message type
  content?: Array<{ type: string; text?: string }>;
  role?: string;
  // For function_call type
  name?: string;
  arguments?: string;
  call_id?: string;
  // For reasoning type
  summary?: unknown[];
}

export interface ResponsesAPIRequest {
  model?: string;
  input: ResponsesAPIInputItem[];
  instructions?: string;
  tools?: Array<{
    type: 'function';
    function?: {
      name: string;
      description?: string;
      parameters?: unknown;
    };
    name?: string;
    description?: string;
    parameters?: unknown;
  }>;
  tool_choice?: string | { type: string; function?: { name: string } };
  max_output_tokens?: number;
  reasoning?: { effort: 'low' | 'medium' | 'high' };
  text?: { format?: { type: string }; verbosity?: 'low' | 'medium' | 'high' };
}

export interface ResponsesAPIResponse {
  id: string;
  status: 'completed' | 'failed' | 'in_progress';
  output: ResponsesAPIOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: string;
  parsedArgs?: Record<string, unknown>;
}

export interface ResponsesAPIOptions {
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  jsonOutput?: boolean;
  timeout?: number;
}

export interface ResponsesAPIResult {
  content: string;
  toolCalls?: ParsedToolCall[];
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model: 'gpt-5.2';  // GPT-5.2 uses Responses API, GPT-5.4 uses Chat Completions
  rawOutput?: ResponsesAPIOutputItem[];
}

// ============================================================
// Configuration
// ============================================================

export const AZURE_GPT52_RESPONSES_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_GPT52_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_GPT52_API_KEY'),
  defaultTimeout: 90000,
};

// ============================================================
// Helper: Check if endpoint uses Responses API
// ============================================================

export function isResponsesAPIEndpoint(endpoint: string): boolean {
  return endpoint.includes('/responses') || endpoint.includes('api-version=2025');
}

// ============================================================
// Helper: Convert Chat Completions messages to Responses API input
// ============================================================

export function convertMessagesToInput(
  messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>
): { instructions: string; input: ResponsesAPIInputItem[] } {
  // Extract system message as instructions
  const systemMessage = messages.find(m => m.role === 'system');
  const instructions = systemMessage?.content || '';
  
  // Convert other messages to input format
  const input: ResponsesAPIInputItem[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') continue; // Already extracted as instructions
    
    if (msg.role === 'tool' && msg.tool_call_id) {
      // Tool result → function_call_output
      input.push({
        type: 'function_call_output',
        call_id: msg.tool_call_id,
        output: msg.content
      });
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      input.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    }
  }
  
  return { instructions, input };
}

// ============================================================
// Helper: Parse tool calls from Responses API output
// ============================================================

export function parseToolCallsFromOutput(output: ResponsesAPIOutputItem[]): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  
  for (const item of output) {
    if (item.type === 'function_call' && item.name) {
      const toolCall: ParsedToolCall = {
        id: item.id || item.call_id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        arguments: item.arguments || '{}'
      };
      
      // Try to parse arguments
      try {
        toolCall.parsedArgs = JSON.parse(toolCall.arguments);
      } catch {
        console.warn(`[Responses API] Failed to parse tool arguments for ${item.name}`);
        toolCall.parsedArgs = {};
      }
      
      toolCalls.push(toolCall);
    }
  }
  
  return toolCalls;
}

// ============================================================
// Helper: Extract text content from Responses API output
// ============================================================

export function extractTextFromOutput(output: ResponsesAPIOutputItem[]): string {
  for (const item of output) {
    if (item.type === 'message' && item.content) {
      // Content is an array of parts
      for (const part of item.content) {
        if (part.type === 'output_text' && part.text) {
          return part.text;
        }
        // Also handle 'text' type
        if (part.type === 'text' && part.text) {
          return part.text;
        }
      }
    }
  }
  return '';
}

// ============================================================
// Helper: Build tool result input for continuation
// ============================================================

/**
 * Build tool result input for continuation - adds function_call_output
 * 
 * NOTE: The function_call items should be added separately from responseData.output
 * This function only adds the result (function_call_output)
 */
export function buildToolResultInput(
  previousInput: ResponsesAPIInputItem[],
  toolCallId: string,
  result: unknown,
  _toolName?: string,  // Unused now - function_call already added from output
  _toolArguments?: string  // Unused now
): ResponsesAPIInputItem[] {
  const newInput = [...previousInput];
  
  // Add the function_call_output (our result)
  // The function_call item should already be in previousInput (added from responseData.output)
  newInput.push({
    type: 'function_call_output' as const,
    call_id: toolCallId,
    output: typeof result === 'string' ? result : JSON.stringify(result)
  });
  
  console.log(`[buildToolResultInput] Added function_call_output for call_id: ${toolCallId}`);
  
  return newInput;
}

// ============================================================
// Main Function: Call GPT-5.2 with Responses API
// ============================================================

export async function callGpt52ResponsesAPI(
  systemPrompt: string,
  userPrompt: string,
  options?: ResponsesAPIOptions
): Promise<ResponsesAPIResult> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  
  return callGpt52ResponsesAPIWithMessages(messages, undefined, options);
}

// ============================================================
// Main Function: Call GPT-5.2 with Responses API (messages format)
// ============================================================

export async function callGpt52ResponsesAPIWithMessages(
  messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>,
  tools?: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>,
  options?: ResponsesAPIOptions
): Promise<ResponsesAPIResult> {
  const endpoint = AZURE_GPT52_RESPONSES_CONFIG.endpoint();
  const apiKey = AZURE_GPT52_RESPONSES_CONFIG.apiKey();
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure GPT-5.2 Responses API not configured');
  }
  
  const timeout = options?.timeout || AZURE_GPT52_RESPONSES_CONFIG.defaultTimeout;
  const maxRetries = 5;
  let consecutiveRateLimits = 0;
  
  // Convert messages to Responses API format
  const { instructions, input } = convertMessagesToInput(messages);
  
  // Build request body
  const requestBody: ResponsesAPIRequest = {
    model: 'gpt-5.2',  // ✅ REQUIRED: Model parameter for Responses API
    input,
    instructions,
    max_output_tokens: options?.maxOutputTokens || 8000,
    reasoning: { effort: options?.reasoningEffort || 'low' },
    text: { verbosity: options?.verbosity || 'medium' }
  };
  
  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools.map(t => ({
      type: 'function' as const,
      function: t.function
    }));
    requestBody.tool_choice = 'auto';
  }
  
  // Add JSON output format if requested
  if (options?.jsonOutput) {
    requestBody.text = {
      ...requestBody.text,
      format: { type: 'json_object' }
    };
  }
  
  while (consecutiveRateLimits <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`[Responses API] Calling GPT-5.2 with ${input.length} input items...`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Handle rate limit with exponential backoff
      if (response.status === 429) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits > maxRetries) {
          throw new Error('[GPT-5.2 Responses API] Max rate limit retries exceeded');
        }
        const backoffMs = Math.min(2000 * Math.pow(2, consecutiveRateLimits - 1), 60000);
        console.warn(`[Responses API] Rate limited (429), waiting ${backoffMs}ms before retry ${consecutiveRateLimits}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Responses API] Error ${response.status}:`, errorText);
        throw new Error(`Azure GPT-5.2 Responses API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
      const data: ResponsesAPIResponse = await response.json();
      
      if (data.status === 'failed' || data.error) {
        throw new Error(`GPT-5.2 Responses API failed: ${data.error?.message || 'Unknown error'}`);
      }
      
      // Extract text content
      const content = extractTextFromOutput(data.output);
      
      // Extract tool calls
      const toolCalls = parseToolCallsFromOutput(data.output);
      
      console.log(`[Responses API] Success - Content: ${content.length} chars, Tool calls: ${toolCalls.length}`);
      
      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          prompt_tokens: data.usage?.input_tokens,
          completion_tokens: data.usage?.output_tokens,
          total_tokens: data.usage?.total_tokens,
        },
        model: 'gpt-5.2',
        rawOutput: data.output,
      };
      
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`[GPT-5.2 Responses API] Request timeout (${timeout / 1000}s)`);
      }
      throw error;
    }
  }
  
  throw new Error('[GPT-5.2 Responses API] Max retries exceeded');
}

// ============================================================
// Function: Continue conversation after tool execution
// ============================================================

export async function continueAfterToolCall(
  previousInput: ResponsesAPIInputItem[],
  toolCallId: string,
  toolResult: unknown,
  instructions: string,
  tools?: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>,
  options?: ResponsesAPIOptions
): Promise<ResponsesAPIResult> {
  const endpoint = AZURE_GPT52_RESPONSES_CONFIG.endpoint();
  const apiKey = AZURE_GPT52_RESPONSES_CONFIG.apiKey();
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure GPT-5.2 Responses API not configured');
  }
  
  const timeout = options?.timeout || AZURE_GPT52_RESPONSES_CONFIG.defaultTimeout;
  
  // Build input with tool result
  const input = buildToolResultInput(previousInput, toolCallId, toolResult);
  
  // Build request body
  const requestBody: ResponsesAPIRequest = {
    input,
    instructions,
    max_output_tokens: options?.maxOutputTokens || 8000,
    reasoning: { effort: options?.reasoningEffort || 'low' },
    text: { verbosity: options?.verbosity || 'medium' }
  };
  
  if (tools && tools.length > 0) {
    requestBody.tools = tools.map(t => ({
      type: 'function' as const,
      function: t.function
    }));
    requestBody.tool_choice = 'auto';
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`[Responses API] Continuing after tool call ${toolCallId}...`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure GPT-5.2 Responses API error: ${response.status}`);
    }
    
    const data: ResponsesAPIResponse = await response.json();
    
    return {
      content: extractTextFromOutput(data.output),
      toolCalls: parseToolCallsFromOutput(data.output).length > 0 
        ? parseToolCallsFromOutput(data.output) 
        : undefined,
      usage: {
        prompt_tokens: data.usage?.input_tokens,
        completion_tokens: data.usage?.output_tokens,
        total_tokens: data.usage?.total_tokens,
      },
      model: 'gpt-5.2',
      rawOutput: data.output,
    };
    
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`[GPT-5.2 Responses API] Request timeout (${timeout / 1000}s)`);
    }
    throw error;
  }
}
