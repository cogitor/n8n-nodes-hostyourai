import { sleep, type IHttpRequestMethods } from 'n8n-workflow';
import {
	BaseChatModel,
	parseSSEStream,
	type ChatModelConfig,
	type GenerateResult,
	type Message,
	type StreamChunk,
	type TokenUsage,
} from '@n8n/ai-node-sdk';
import {
	DEFAULT_COLD_START_RETRIES,
	DEFAULT_COLD_START_WAIT_SECONDS,
} from '../shared/hostYourAiConfig';

interface ModelConfig extends ChatModelConfig {
	url: string;
	task?: 'chat' | 'code' | 'summarise' | 'classify' | 'extract' | 'rag' | 'legal' | 'reason';
	policy?: 'balanced' | 'speed' | 'cost' | 'quality';
	transport?: 'body' | 'headers';
	maxColdStartRetries?: number;
	maxColdStartWaitSeconds?: number;
}

type OpenAiMessage = {
	role: string;
	content: string;
};

type CompletionResponse = {
	id?: string;
	choices?: Array<{
		finish_reason?: string;
		message?: {
			content?: string | Array<{ type?: string; text?: string }>;
		};
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	error?: {
		message?: string;
		type?: string;
		code?: string | number;
	};
	message?: string;
};

interface RequestResult {
	body: unknown;
	headers?: Record<string, string | number | string[]>;
	statusCode: number;
}

interface RequestConfig {
	httpRequest: (
		method: IHttpRequestMethods,
		url: string,
		body?: object,
		headers?: Record<string, string>,
	) => Promise<RequestResult>;
	openStream: (
		method: IHttpRequestMethods,
		url: string,
		body?: object,
		headers?: Record<string, string>,
	) => Promise<{ body: AsyncIterableIterator<Buffer | Uint8Array> }>;
}

type StreamDelta = {
	content?: string | Array<{ type?: string; text?: string }>;
};

type StreamChoice = {
	delta?: StreamDelta;
	finish_reason?: string | null;
};

type StreamResponse = {
	choices?: StreamChoice[];
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
};

function toSeconds(value: unknown): number | undefined {
	if (Array.isArray(value)) return toSeconds(value[0]);
	if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
	if (typeof value === 'string') {
		const asInt = Number.parseInt(value, 10);
		if (!Number.isNaN(asInt) && /^\s*\d+\s*$/.test(value)) return Math.max(0, asInt);

		const asDateMs = Date.parse(value);
		if (!Number.isNaN(asDateMs)) {
			const deltaSeconds = Math.ceil((asDateMs - Date.now()) / 1000);
			return Math.max(0, deltaSeconds);
		}
	}
	return undefined;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function sanitizeErrorDetail(body: unknown): string {
	if (!body || typeof body !== 'object') return 'No error details returned';

	const maybeResponse = body as CompletionResponse;
	const message = maybeResponse.error?.message ?? maybeResponse.message;
	if (typeof message === 'string' && message.trim() !== '') {
		return message.trim().slice(0, 512);
	}

	return 'No error details returned';
}

function readHeader(
	headers: Record<string, string | number | string[]> | undefined,
	name: string,
): string | number | string[] | undefined {
	if (!headers) return undefined;
	const lowered = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lowered) return value;
	}
	return undefined;
}

export class HostYourAiChatModel extends BaseChatModel<ModelConfig> {
	private readonly baseURL: string;
	private readonly configDefaults: ModelConfig;

	constructor(
		modelId: string,
		private readonly requests: RequestConfig,
		config: ModelConfig,
	) {
		super('hostyourai', modelId, config);
		this.baseURL = config.url.replace(/\/+$/, '');
		this.configDefaults = config;
	}

	private buildMessages(messages: Message[]): OpenAiMessage[] {
		return messages.map((m) => ({
			role: m.role,
			content: m.content
				.filter((c) => c.type === 'text')
				.map((c) => c.text)
				.join('\n'),
		}));
	}

	private buildRequest(messages: Message[], merged: ModelConfig): {
		body: Record<string, unknown>;
		headers: Record<string, string>;
	} {
		const body: Record<string, unknown> = {
			model: this.modelId,
			messages: this.buildMessages(messages),
		};

		if (typeof merged.temperature === 'number') {
			body.temperature = merged.temperature;
		}

		const isRouterAutoModel = this.modelId === 'hyai/auto';

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (isRouterAutoModel) {
			const task = merged.task ?? 'chat';
			const policy = merged.policy ?? 'balanced';
			const transport = merged.transport ?? 'body';

			if (transport === 'headers') {
				headers['X-HYAI-Task'] = task;
				headers['X-HYAI-Policy'] = policy;
			} else {
				body.hyai = { task, policy };
			}
		}

		return { body, headers };
	}

	private parseText(body: CompletionResponse): string | undefined {
		const content = body.choices?.[0]?.message?.content;
		if (typeof content === 'string') {
			const trimmed = content.trim();
			return trimmed.length > 0 ? trimmed : undefined;
		}
		if (Array.isArray(content)) {
			const joined = content
				.map((part) => (typeof part?.text === 'string' ? part.text : ''))
				.join('')
				.trim();
			return joined.length > 0 ? joined : undefined;
		}
		return undefined;
	}

	private parseStreamDeltaText(choice: StreamChoice): string | undefined {
		const content = choice.delta?.content;
		if (typeof content === 'string' && content.length > 0) {
			return content;
		}
		if (Array.isArray(content)) {
			const joined = content
				.map((part) => (typeof part?.text === 'string' ? part.text : ''))
				.join('');
			return joined.length > 0 ? joined : undefined;
		}
		return undefined;
	}

	private parseUsage(usage: CompletionResponse['usage'] | StreamResponse['usage']): TokenUsage {
		return {
			promptTokens: usage?.prompt_tokens ?? 0,
			completionTokens: usage?.completion_tokens ?? 0,
			totalTokens: usage?.total_tokens ?? 0,
		};
	}

	private mapFinishReason(reason: string | undefined): GenerateResult['finishReason'] {
		switch (reason) {
			case 'length':
				return 'length';
			case 'tool_calls':
			case 'tool-calls':
				return 'tool-calls';
			case 'content_filter':
			case 'content-filter':
				return 'content-filter';
			case 'stop':
				return 'stop';
			default:
				return 'other';
		}
	}

	private async requestWithWarmupRetry(
		body: Record<string, unknown>,
		headers: Record<string, string>,
		merged: ModelConfig,
	): Promise<RequestResult> {
		const maxRetries = clampInt(
			merged.maxColdStartRetries,
			0,
			30,
			DEFAULT_COLD_START_RETRIES,
		);
		const maxWaitSeconds = clampInt(
			merged.maxColdStartWaitSeconds,
			1,
			600,
			DEFAULT_COLD_START_WAIT_SECONDS,
		);
		let waited = 0;
		let attempt = 0;

		while (true) {
			const response = await this.requests.httpRequest(
				'POST',
				`${this.baseURL}/chat/completions`,
				body,
				headers,
			);

			if (response.statusCode === 503) {
				if (attempt >= maxRetries) {
					throw new Error('HostYourAI model is still warming up (503). Retry budget exhausted.');
				}

				const retryAfter = toSeconds(readHeader(response.headers, 'retry-after'));
				const eta = toSeconds(readHeader(response.headers, 'x-hyai-eta-seconds'));
				const waitSeconds = clampInt(retryAfter ?? eta ?? 3, 1, maxWaitSeconds, 3);

				if (waited + waitSeconds > maxWaitSeconds) {
					throw new Error(
						`HostYourAI cold start exceeds max wait (${maxWaitSeconds}s). Last suggested wait: ${waitSeconds}s.`,
					);
				}

				await sleep(waitSeconds * 1000);
				waited += waitSeconds;
				attempt += 1;
				continue;
			}

			if (response.statusCode < 200 || response.statusCode >= 300) {
				const detail = sanitizeErrorDetail(response.body);
				throw new Error(`HostYourAI request failed (${response.statusCode}): ${detail}`);
			}

			return response;
		}
	}

	async generate(messages: Message[], config?: ModelConfig): Promise<GenerateResult> {
		const merged = { ...this.configDefaults, ...config } as ModelConfig;
		const request = this.buildRequest(messages, merged);
		const response = await this.requestWithWarmupRetry(request.body, request.headers, merged);
		const body = response.body as CompletionResponse;

		if (!body || typeof body !== 'object' || !Array.isArray(body.choices) || body.choices.length === 0) {
			throw new Error('Malformed HostYourAI response: missing choices[0].message.content');
		}

		const text = this.parseText(body);
		if (typeof text !== 'string' || text.length === 0) {
			throw new Error('Malformed HostYourAI response: missing choices[0].message.content');
		}
		const message: Message = {
			role: 'assistant',
			content: [{ type: 'text', text }],
		};

		return {
			id: body.id,
			finishReason: this.mapFinishReason(body.choices?.[0]?.finish_reason),
			usage: this.parseUsage(body.usage),
			message,
		};
	}

	async *stream(messages: Message[], config?: ModelConfig): AsyncIterable<StreamChunk> {
		const merged = { ...this.configDefaults, ...config } as ModelConfig;
		const request = this.buildRequest(messages, merged);
		request.body.stream = true;
		const streamResponse = await this.requests.openStream(
			'POST',
			`${this.baseURL}/chat/completions`,
			request.body,
			request.headers,
		);

		let finished = false;

		for await (const event of parseSSEStream(streamResponse.body)) {
			if (!event.data || event.data === '[DONE]') {
				continue;
			}

			let payload: StreamResponse;
			try {
				payload = JSON.parse(event.data) as StreamResponse;
			} catch {
				continue;
			}

			const choices = Array.isArray(payload.choices) ? payload.choices : [];
			for (const choice of choices) {
				const deltaText = this.parseStreamDeltaText(choice);
				if (deltaText) {
					yield { type: 'text-delta', delta: deltaText };
				}

				if (choice.finish_reason) {
					yield {
						type: 'finish',
						finishReason: this.mapFinishReason(choice.finish_reason) ?? 'other',
						usage: this.parseUsage(payload.usage),
					};
					finished = true;
					break;
				}
			}

			if (finished) {
				break;
			}
		}

		if (!finished) {
			yield {
				type: 'finish',
				finishReason: 'stop',
			};
		}
	}
}
