import { type Message } from '@n8n/ai-node-sdk';
import { describe, expect, it, vi } from 'vitest';
import { HostYourAiChatModel } from '../nodes/HostYourAiChatModel/model';

describe('HostYourAiChatModel', () => {
	const baseConfig = {
		url: 'https://hostyourai.com/api/v1',
		transport: 'body' as const,
		task: 'chat' as const,
		policy: 'balanced' as const,
		maxColdStartRetries: 2,
		maxColdStartWaitSeconds: 5,
	};

	const mkMessage = (): Message[] => [
		{
			role: 'user',
			content: [{ type: 'text', text: 'Hello' }],
		},
	];

	type Requests = ConstructorParameters<typeof HostYourAiChatModel>[1];
	type RequestFn = Requests['httpRequest'];
	type OpenStreamFn = Requests['openStream'];
	type ModelOverrides = Partial<ConstructorParameters<typeof HostYourAiChatModel>[2]>;

	async function* emptyStream(): AsyncIterableIterator<Buffer | Uint8Array> {
		yield* [];
	}

	const okResponse = (content = 'ok', finishReason = 'stop') => ({
		statusCode: 200,
		headers: {},
		body: { choices: [{ message: { content }, finish_reason: finishReason }] },
	});

	const makeModel = (
		httpRequest: RequestFn,
		overrides: ModelOverrides = {},
		modelId = 'hyai/auto',
		openStream?: OpenStreamFn,
	) =>
		new HostYourAiChatModel(
			modelId,
			{ httpRequest, openStream: openStream ?? (async () => ({ statusCode: 200, headers: {}, body: emptyStream() })) },
			{ ...baseConfig, ...overrides },
		);

	it('applies hyai body params when model is hyai/auto and transport=body', async () => {
		let capturedBody: Record<string, unknown> | undefined;
		let capturedHeaders: Record<string, string> | undefined;

		const model = makeModel(
			vi.fn(async (_method, _url, body, headers) => {
				capturedBody = body;
				capturedHeaders = headers;
				return {
					...okResponse(),
					body: {
						...okResponse().body,
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
					},
				};
			}),
		);

		await model.generate(mkMessage());
		expect(capturedBody).toBeDefined();
		expect(capturedHeaders).toBeDefined();
		expect(capturedBody?.hyai).toEqual({ task: 'chat', policy: 'balanced' });
		expect(capturedHeaders?.['X-HYAI-Task']).toBeUndefined();
		expect(capturedHeaders?.['X-HYAI-Policy']).toBeUndefined();
	});

	it('falls back to X-HYAI headers when body.hyai is rejected with 422 extra_forbidden', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 422,
				headers: {},
				body: {
					detail: [
						{
							type: 'extra_forbidden',
							loc: ['body', 'hyai'],
							msg: 'Extra inputs are not permitted',
							input: { task: 'chat', policy: 'cost' },
						},
					],
				},
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
			});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, policy: 'cost', transport: 'body' },
		);

		await model.generate(mkMessage());
		expect(httpRequest).toHaveBeenCalledTimes(2);

		const firstCallBody = httpRequest.mock.calls[0]?.[2] as Record<string, unknown>;
		const firstCallHeaders = httpRequest.mock.calls[0]?.[3] as Record<string, string>;
		const secondCallBody = httpRequest.mock.calls[1]?.[2] as Record<string, unknown>;
		const secondCallHeaders = httpRequest.mock.calls[1]?.[3] as Record<string, string>;

		expect(firstCallBody?.hyai).toEqual({ task: 'chat', policy: 'cost' });
		expect(firstCallHeaders?.['X-HYAI-Task']).toBeUndefined();
		expect(firstCallHeaders?.['X-HYAI-Policy']).toBeUndefined();

		expect(secondCallBody?.hyai).toBeUndefined();
		expect(secondCallHeaders?.['X-HYAI-Task']).toBe('chat');
		expect(secondCallHeaders?.['X-HYAI-Policy']).toBe('cost');
	});

	it('does not fallback for unrelated 422 errors', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 422,
				headers: {},
				body: { detail: [{ type: 'missing', loc: ['body', 'messages'] }] },
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('HostYourAI request failed (422)');
	});

	it('does not fallback for non-auto models', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 422,
				headers: {},
				body: {
					detail: [{ type: 'extra_forbidden', loc: ['body', 'hyai'] }],
				},
			})),
			{ transport: 'body' },
			'gpt-4o-mini',
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('HostYourAI request failed (422)');
	});

	it('does not fallback when transport is already headers', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 422,
				headers: {},
				body: {
					detail: [{ type: 'extra_forbidden', loc: ['body', 'hyai'] }],
				},
			})),
			{ transport: 'headers' },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('HostYourAI request failed (422)');
	});

	it('applies hyai headers when model is hyai/auto and transport=headers', async () => {
		let capturedBody: Record<string, unknown> | undefined;
		let capturedHeaders: Record<string, string> | undefined;

		const model = makeModel(
			vi.fn(async (_method, _url, body, headers) => {
				capturedBody = body;
				capturedHeaders = headers;
				return okResponse();
			}),
			{ transport: 'headers' },
		);

		await model.generate(mkMessage());
		expect(capturedBody).toBeDefined();
		expect(capturedHeaders).toBeDefined();
		expect(capturedBody?.hyai).toBeUndefined();
		expect(capturedHeaders?.['X-HYAI-Task']).toBe('chat');
		expect(capturedHeaders?.['X-HYAI-Policy']).toBe('balanced');
	});

	it('does not apply hyai body or headers for non-default model', async () => {
		let capturedBody: Record<string, unknown> | undefined;
		let capturedHeaders: Record<string, string> | undefined;

		const model = makeModel(
			vi.fn(async (_method, _url, body, headers) => {
				capturedBody = body;
				capturedHeaders = headers;
				return okResponse();
			}),
			{ transport: 'headers' },
			'gpt-4o-mini',
		);

		await model.generate(mkMessage());
		expect(capturedBody).toBeDefined();
		expect(capturedHeaders).toBeDefined();
		expect(capturedBody?.hyai).toBeUndefined();
		expect(capturedHeaders?.['X-HYAI-Task']).toBeUndefined();
		expect(capturedHeaders?.['X-HYAI-Policy']).toBeUndefined();
	});

	it('retries on 503 using warmup logic', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
			});

		const model = new HostYourAiChatModel('hyai/auto', { httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) }, baseConfig);

		await model.generate(mkMessage());
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('throws on non-503 HTTP error', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 401,
				headers: {},
				body: { error: { message: 'unauthorized' } },
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('HostYourAI request failed (401): unauthorized');
	});

	it('throws when warmup retry budget is exhausted', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 503,
			headers: { 'retry-after': '0' },
			body: { error: 'warming' },
		});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartRetries: 1 },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('Retry budget exhausted');
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('throws when warmup wait would exceed max cap', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 503,
			headers: { 'retry-after': '4' },
			body: { error: 'warming' },
		});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartWaitSeconds: 3 },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('cold start exceeds max wait');
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('uses X-HYAI-Eta-Seconds when Retry-After is absent', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'x-hyai-eta-seconds': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
			});

		const model = new HostYourAiChatModel('hyai/auto', { httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) }, baseConfig);
		await model.generate(mkMessage());
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('parses Retry-After HTTP-date format', async () => {
		const pastDate = new Date(Date.now() - 10_000).toUTCString();
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': pastDate },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
			});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartWaitSeconds: 1 },
		);
		await model.generate(mkMessage());
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('maps provider finish_reason variants to SDK finishReason', async () => {
		const cases: Array<{ provider: string; expected: string }> = [
			{ provider: 'tool_calls', expected: 'tool-calls' },
			{ provider: 'tool-calls', expected: 'tool-calls' },
			{ provider: 'content_filter', expected: 'content-filter' },
			{ provider: 'content-filter', expected: 'content-filter' },
			{ provider: 'length', expected: 'length' },
			{ provider: 'stop', expected: 'stop' },
			{ provider: 'unknown', expected: 'other' },
		];

		for (const testCase of cases) {
			const model = new HostYourAiChatModel(
				'hyai/auto',
				{
					httpRequest: vi.fn(async () => ({
						statusCode: 200,
						headers: {},
						body: { choices: [{ message: { content: 'ok' }, finish_reason: testCase.provider }] },
					})),
				},
				baseConfig,
			);

			const result = await model.generate(mkMessage());
			expect(result.finishReason).toBe(testCase.expected);
		}
	});

	it('uses response.body.message fallback when error.message is absent', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 429,
				headers: {},
				body: { message: 'rate limited' },
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('HostYourAI request failed (429): rate limited');
	});

	it('uses sanitized fallback when error details are absent', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 500,
				headers: {},
				body: { foo: 'bar' },
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow(
			'HostYourAI request failed (500): No error details returned',
		);
	});

	it('prefers Retry-After over X-HYAI-Eta-Seconds when both are present', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0', 'x-hyai-eta-seconds': '9' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
			});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartWaitSeconds: 1 },
		);
		await model.generate(mkMessage());
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('enforces cumulative warmup wait cap across retries', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '2' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '2' },
				body: { error: 'warming' },
			});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartWaitSeconds: 3, maxColdStartRetries: 2 },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('cold start exceeds max wait');
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('throws on malformed 200 response with missing content', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 200,
				headers: {},
				body: { choices: [{ message: {} }] },
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow(
			'Malformed HostYourAI response: missing choices[0].message.content',
		);
	});

	it('throws on malformed 200 response with null body', async () => {
		const model = makeModel(
			vi.fn(async () => ({
				statusCode: 200,
				headers: {},
				body: null,
			})),
		);

		await expect(model.generate(mkMessage())).rejects.toThrow(
			'Malformed HostYourAI response: missing choices[0].message.content',
		);
	});

	it('clamps non-finite retry settings to safe defaults', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: { 'retry-after': '0' },
				body: { error: 'warming' },
			});

		const model = new HostYourAiChatModel(
			'hyai/auto',
			{ httpRequest, openStream: async () => ({ statusCode: 200, headers: {}, body: emptyStream() }) },
			{ ...baseConfig, maxColdStartRetries: Number.NaN, maxColdStartWaitSeconds: Number.NaN },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('Retry budget exhausted');
		expect(httpRequest).toHaveBeenCalledTimes(5);
	});

	it('streams text deltas and finish events from SSE', async () => {
		async function* sseStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n');
			yield Buffer.from('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n');
			yield Buffer.from(
				'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n',
			);
			yield Buffer.from('data: [DONE]\n\n');
		}

		const model = makeModel(
			vi.fn(async () => okResponse()),
			{},
			'hyai/auto',
			async () => ({ statusCode: 200, headers: {}, body: sseStream() }),
		);

		const chunks: Array<{ type: string; delta?: string; finishReason?: string; usage?: unknown }> = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunks.push({
				type: chunk.type,
				delta: 'delta' in chunk ? chunk.delta : undefined,
				finishReason: 'finishReason' in chunk ? chunk.finishReason : undefined,
				usage: 'usage' in chunk ? chunk.usage : undefined,
			});
		}

		expect(chunks).toEqual([
			{ type: 'text-delta', delta: 'Hel', finishReason: undefined, usage: undefined },
			{ type: 'text-delta', delta: 'lo', finishReason: undefined, usage: undefined },
			{
				type: 'finish',
				delta: undefined,
				finishReason: 'stop',
				usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
			},
		]);
	});

	it('ignores malformed JSON SSE events and continues streaming', async () => {
		async function* sseStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: this-is-not-json\n\n');
			yield Buffer.from('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
			yield Buffer.from('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
		}

		const model = makeModel(vi.fn(async () => okResponse()), {}, 'hyai/auto', async () => ({
			statusCode: 200,
			headers: {},
			body: sseStream(),
		}));

		const chunks: Array<{ type: string; delta?: string }> = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunks.push({ type: chunk.type, delta: 'delta' in chunk ? chunk.delta : undefined });
		}

		expect(chunks).toEqual([
			{ type: 'text-delta', delta: 'ok' },
			{ type: 'finish', delta: undefined },
		]);
	});

	it('emits fallback finish once when stream only sends [DONE]', async () => {
		async function* sseStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: [DONE]\n\n');
		}

		const model = makeModel(vi.fn(async () => okResponse()), {}, 'hyai/auto', async () => ({
			statusCode: 200,
			headers: {},
			body: sseStream(),
		}));

		const chunkTypes: string[] = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunkTypes.push(chunk.type);
		}

		expect(chunkTypes).toEqual(['finish']);
	});

	it('handles events with missing choices without crashing', async () => {
		async function* sseStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: {"usage":{"prompt_tokens":1}}\n\n');
		}

		const model = makeModel(vi.fn(async () => okResponse()), {}, 'hyai/auto', async () => ({
			statusCode: 200,
			headers: {},
			body: sseStream(),
		}));

		const chunkTypes: string[] = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunkTypes.push(chunk.type);
		}

		expect(chunkTypes).toEqual(['finish']);
	});

	it('joins array delta content parts in stream chunks', async () => {
		async function* sseStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from(
				'data: {"choices":[{"delta":{"content":[{"type":"output_text","text":"He"},{"type":"output_text","text":"llo"}]}}]}\n\n',
			);
			yield Buffer.from('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
		}

		const model = makeModel(vi.fn(async () => okResponse()), {}, 'hyai/auto', async () => ({
			statusCode: 200,
			headers: {},
			body: sseStream(),
		}));

		const textDeltas: string[] = [];
		for await (const chunk of model.stream(mkMessage())) {
			if (chunk.type === 'text-delta') {
				textDeltas.push(chunk.delta);
			}
		}

		expect(textDeltas).toEqual(['Hello']);
	});

	it('propagates openStream errors', async () => {
		const model = makeModel(
			vi.fn(async () => okResponse()),
			{},
			'hyai/auto',
			async () => {
				throw new Error('stream failed');
			},
		);

		const run = async () => {
			for await (const _chunk of model.stream(mkMessage())) {
				void _chunk;
			}
		};

		await expect(run()).rejects.toThrow('stream failed');
	});

	it('retries streaming request with X-HYAI headers when body.hyai is rejected', async () => {
		async function* successStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
			yield Buffer.from('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
		}

		const openStream = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 422,
				headers: {},
				body: {
					detail: [
						{ type: 'extra_forbidden', loc: ['body', 'hyai', 'task'], msg: 'Extra inputs are not permitted' },
					],
				},
			})
			.mockResolvedValueOnce({ statusCode: 200, headers: {}, body: successStream() });

		const model = makeModel(
			vi.fn(async () => okResponse()),
			{ policy: 'cost', transport: 'body' },
			'hyai/auto',
			openStream,
		);

		const chunkTypes: string[] = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunkTypes.push(chunk.type);
		}

		expect(chunkTypes).toEqual(['text-delta', 'finish']);
		expect(openStream).toHaveBeenCalledTimes(2);

		const firstBody = openStream.mock.calls[0]?.[2] as Record<string, unknown>;
		const firstHeaders = openStream.mock.calls[0]?.[3] as Record<string, string>;
		const secondBody = openStream.mock.calls[1]?.[2] as Record<string, unknown>;
		const secondHeaders = openStream.mock.calls[1]?.[3] as Record<string, string>;

		expect(firstBody.hyai).toEqual({ task: 'chat', policy: 'cost' });
		expect(firstHeaders?.['X-HYAI-Task']).toBeUndefined();
		expect(secondBody.hyai).toBeUndefined();
		expect(secondHeaders['X-HYAI-Task']).toBe('chat');
		expect(secondHeaders['X-HYAI-Policy']).toBe('cost');
	});

	it('retries streaming on 503 warmup responses', async () => {
		async function* successStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
		}

		const openStream = vi
			.fn()
			.mockResolvedValueOnce({ statusCode: 503, headers: { 'retry-after': '0' }, body: { error: 'warming' } })
			.mockResolvedValueOnce({ statusCode: 200, headers: {}, body: successStream() });

		const model = makeModel(vi.fn(async () => okResponse()), {}, 'hyai/auto', openStream);
		const chunkTypes: string[] = [];
		for await (const chunk of model.stream(mkMessage())) {
			chunkTypes.push(chunk.type);
		}

		expect(openStream).toHaveBeenCalledTimes(2);
		expect(chunkTypes).toEqual(['finish']);
	});

	it('propagates mid-stream iterator errors after yielding prior chunks', async () => {
		async function* brokenStream(): AsyncIterableIterator<Buffer> {
			yield Buffer.from('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
			throw new Error('stream disconnected');
		}

		const model = makeModel(
			vi.fn(async () => okResponse()),
			{},
			'hyai/auto',
			async () => ({ statusCode: 200, headers: {}, body: brokenStream() }),
		);

		const seen: string[] = [];
		const run = async () => {
			for await (const chunk of model.stream(mkMessage())) {
				seen.push(chunk.type);
			}
		};

		await expect(run()).rejects.toThrow('stream disconnected');
		expect(seen).toEqual(['text-delta']);
	});

	it('sends stream=true and router hints in headers transport for hyai/auto', async () => {
		let capturedBody: Record<string, unknown> | undefined;
		let capturedHeaders: Record<string, string> | undefined;

		const model = makeModel(
			vi.fn(async () => okResponse()),
			{ transport: 'headers' },
			'hyai/auto',
			async (_method, _url, body, headers) => {
				capturedBody = body as Record<string, unknown>;
				capturedHeaders = headers;
				return { statusCode: 200, headers: {}, body: emptyStream() };
			},
		);

		for await (const _chunk of model.stream(mkMessage())) {
			void _chunk;
		}

		expect(capturedBody?.stream).toBe(true);
		expect(capturedBody?.hyai).toBeUndefined();
		expect(capturedHeaders?.['X-HYAI-Task']).toBe('chat');
		expect(capturedHeaders?.['X-HYAI-Policy']).toBe('balanced');
	});
});
