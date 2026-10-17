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

	type RequestFn = ConstructorParameters<typeof HostYourAiChatModel>[1]['httpRequest'];
	type ModelOverrides = Partial<ConstructorParameters<typeof HostYourAiChatModel>[2]>;

	const okResponse = (content = 'ok', finishReason = 'stop') => ({
		statusCode: 200,
		headers: {},
		body: { choices: [{ message: { content }, finish_reason: finishReason }] },
	});

	const makeModel = (
		httpRequest: RequestFn,
		overrides: ModelOverrides = {},
		modelId = 'hyai/auto',
	) => new HostYourAiChatModel(modelId, { httpRequest }, { ...baseConfig, ...overrides });

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

		const model = new HostYourAiChatModel('hyai/auto', { httpRequest }, baseConfig);

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
			{ httpRequest },
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
			{ httpRequest },
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

		const model = new HostYourAiChatModel('hyai/auto', { httpRequest }, baseConfig);
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
			{ httpRequest },
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
			{ httpRequest },
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
			{ httpRequest },
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
			{ httpRequest },
			{ ...baseConfig, maxColdStartRetries: Number.NaN, maxColdStartWaitSeconds: Number.NaN },
		);

		await expect(model.generate(mkMessage())).rejects.toThrow('Retry budget exhausted');
		expect(httpRequest).toHaveBeenCalledTimes(5);
	});

	it('throws explicit error for streaming calls', async () => {
		const model = makeModel(vi.fn(async () => okResponse()));
		const run = async () => {
			for await (const chunk of model.stream(mkMessage())) {
				void chunk;
			}
		};
		await expect(run()).rejects.toThrow('streaming is not supported');
	});
});
