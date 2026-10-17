import { describe, expect, it } from 'vitest';
import { HostYourAiApi } from '../credentials/HostYourAiApi.credentials';

describe('HostYourAiApi credentials', () => {
	it('accepts default trusted base URL and injects bearer token', async () => {
		const credential = new HostYourAiApi();
		const request = await credential.authenticate(
			{ apiKey: 'secret', url: 'https://hostyourai.com/api/v1' },
			{},
		);

		expect(request.headers?.Authorization).toBe('Bearer secret');
	});

	it('rejects non-allowlisted credential base URL during authentication', async () => {
		const credential = new HostYourAiApi();
		await expect(
			credential.authenticate({ apiKey: 'secret', url: 'https://example.com/api/v1' }, {}),
		).rejects.toThrow('Base URL host must be hostyourai.com or its subdomain');
	});
});
