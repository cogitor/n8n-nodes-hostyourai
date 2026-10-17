import { describe, expect, it } from 'vitest';
import { HostYourAiApi } from '../credentials/HostYourAiApi.credentials';

describe('HostYourAiApi credentials', () => {
	it('injects bearer token for authenticated requests', async () => {
		const credential = new HostYourAiApi();
		const request = await credential.authenticate({ apiKey: 'secret' }, { url: '/models' });

		expect(request.headers?.Authorization).toBe('Bearer secret');
	});

	it('uses default API base URL in credential test request', () => {
		const credential = new HostYourAiApi();
		expect(credential.test.request.baseURL).toBe('https://hostyourai.com/api/v1');
	});
});
