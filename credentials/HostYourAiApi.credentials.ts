import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
	Icon,
} from 'n8n-workflow';
import { DEFAULT_BASE_URL, validateBaseUrl } from '../nodes/shared/hostYourAiConfig';

export class HostYourAiApi implements ICredentialType {
	name = 'hostYourAiApi';

	displayName = 'HostYourAI API';

	documentationUrl = 'https://hostyourai.com/app/docs';

	icon: Icon = { light: 'file:../icons/hostyourai.svg', dark: 'file:../icons/hostyourai.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'string',
			default: DEFAULT_BASE_URL,
			description: 'Base URL for HostYourAI OpenAI-compatible endpoint',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.url}}',
			url: '/models',
			method: 'GET',
		},
	};

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const validation = validateBaseUrl(credentials.url);
		if (!validation.isValid) {
			throw new Error(validation.error);
		}
		requestOptions.headers ??= {};
		requestOptions.headers.Authorization = `Bearer ${credentials.apiKey}`;
		return requestOptions;
	}
}
