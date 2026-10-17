import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
	Icon,
} from 'n8n-workflow';
import { DEFAULT_BASE_URL } from '../nodes/shared/hostYourAiConfig';

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
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: DEFAULT_BASE_URL,
			url: '/models',
			method: 'GET',
		},
	};

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers ??= {};
		requestOptions.headers.Authorization = `Bearer ${credentials.apiKey}`;
		return requestOptions;
	}
}
