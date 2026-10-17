import { describe, expect, it, vi } from 'vitest';
import { HostYourAiChatModel } from '../nodes/HostYourAiChatModel/HostYourAiChatModel.node';

describe('HostYourAiChatModel node loadOptions', () => {
	const fallbackOption = [{ name: 'Auto (hyai/auto)', value: 'hyai/auto' }];

	const makeContext = (
		credentialsFactory: () => Promise<Record<string, unknown>>,
		callImpl: () => Promise<unknown> = async () => ({}),
	) => {
		const call = vi.fn(callImpl);
		const ctx = {
			getCredentials: vi.fn(credentialsFactory),
			helpers: {
				httpRequestWithAuthentication: {
					call,
				},
			},
		};
		return { ctx, call };
	};

	it('returns auto first and sorted model list from credentials-backed /models response', async () => {
		const node = new HostYourAiChatModel();
		const call = vi.fn(async () => ({
			data: [
				{ id: 'mistral-small' },
				{ id: 'hyai/auto' },
				{ id: 'claude-3.5-sonnet' },
			],
		}));

		const ctx = {
			getCredentials: vi.fn(async () => ({})),
			helpers: {
				httpRequestWithAuthentication: {
					call,
				},
			},
		};

		const models = await node.methods.loadOptions.getModels.call(ctx as never);

		expect(ctx.getCredentials).toHaveBeenCalledWith('hostYourAiApi');
		expect(call).toHaveBeenCalledTimes(1);
		expect(call).toHaveBeenCalledWith(
			ctx,
			'hostYourAiApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://hostyourai.com/api/v1/models',
				json: true,
			}),
		);
		expect(models).toEqual([
			{ name: 'Auto (hyai/auto)', value: 'hyai/auto' },
			{ name: 'claude-3.5-sonnet', value: 'claude-3.5-sonnet' },
			{ name: 'mistral-small', value: 'mistral-small' },
		]);
	});

	it('deduplicates ids and ignores invalid ids from /models response', async () => {
		const node = new HostYourAiChatModel();
		const call = vi.fn(async () => ({
			data: [
				{ id: 'hyai/auto' },
				{ id: 'mistral-small' },
				{ id: 'mistral-small' },
				{ id: '' },
				{},
			],
		}));

		const ctx = {
			getCredentials: vi.fn(async () => ({})),
			helpers: {
				httpRequestWithAuthentication: {
					call,
				},
			},
		};

		const models = await node.methods.loadOptions.getModels.call(ctx as never);

		expect(call).toHaveBeenCalledWith(
			ctx,
			'hostYourAiApi',
			expect.objectContaining({
				url: 'https://hostyourai.com/api/v1/models',
			}),
		);
		expect(models).toEqual([
			{ name: 'Auto (hyai/auto)', value: 'hyai/auto' },
			{ name: 'mistral-small', value: 'mistral-small' },
		]);
	});

	it('uses default base URL for /models requests', async () => {
		const node = new HostYourAiChatModel();
		const { ctx, call } = makeContext(async () => ({}), async () => ({ data: [] }));

		await node.methods.loadOptions.getModels.call(ctx as never);
		expect(call).toHaveBeenCalledWith(
			ctx,
			'hostYourAiApi',
			expect.objectContaining({
				url: 'https://hostyourai.com/api/v1/models',
			}),
		);
	});

	it.each([
		[
			'provider responds with no models',
			async () => ({}),
			async () => ({}),
			true,
		],
		[
			'/models payload shape is malformed',
			async () => ({}),
			async () => ({ data: { id: 'not-an-array' } }),
			true,
		],
		[
			'/models request fails',
			async () => ({}),
			async () => {
				throw new Error('401 Unauthorized');
			},
			true,
		],
		[
			'credentials lookup fails',
			async () => {
				throw new Error('missing credentials');
			},
			async () => ({}),
			false,
		],
	] as const)('returns fallback option when %s', async (_label, credentialsFactory, callImpl, shouldCall) => {
		const node = new HostYourAiChatModel();
		const { ctx, call } = makeContext(credentialsFactory, callImpl);

		const models = await node.methods.loadOptions.getModels.call(ctx as never);
		expect(models).toEqual(fallbackOption);
		if (shouldCall) {
			expect(call).toHaveBeenCalledWith(
				ctx,
				'hostYourAiApi',
				expect.objectContaining({
					url: 'https://hostyourai.com/api/v1/models',
				}),
			);
		} else {
			expect(call).not.toHaveBeenCalled();
		}
	});

	it('keeps manual model ID capability enabled for expression input', () => {
		const node = new HostYourAiChatModel();
		const modelParam = node.description.properties.find((p) => p.name === 'model');
		expect(modelParam).toBeDefined();
		expect(modelParam?.noDataExpression).not.toBe(true);
	});
});
