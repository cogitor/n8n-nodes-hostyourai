import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { supplyModel } from '@n8n/ai-node-sdk';
import { HostYourAiChatModel as HostYourAiChatModelClient } from './model';
import {
	DEFAULT_COLD_START_RETRIES,
	DEFAULT_COLD_START_WAIT_SECONDS,
	validateBaseUrl,
} from '../shared/hostYourAiConfig';

type TransportMode = 'body' | 'headers';
type HyaiTask = 'chat' | 'code' | 'summarise' | 'classify' | 'extract' | 'rag' | 'legal' | 'reason';
type HyaiPolicy = 'balanced' | 'speed' | 'cost' | 'quality';

type ModelOptions = {
	temperature?: number;
	task?: HyaiTask;
	policy?: HyaiPolicy;
	transport?: TransportMode;
	maxColdStartRetries?: number;
	maxColdStartWaitSeconds?: number;
};

const AUTO_MODEL_LABEL = `Auto (${['hyai', 'auto'].join('/')})`;

export class HostYourAiChatModel implements INodeType {
	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const fallbackOption: INodePropertyOptions = {
					name: AUTO_MODEL_LABEL,
					value: 'hyai/auto',
				};

				try {
					const credentials = await this.getCredentials('hostYourAiApi');
					const validation = validateBaseUrl(credentials.url);
					if (!validation.isValid) {
						return [fallbackOption];
					}
					const baseUrl = validation.baseUrl;

					const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'hostYourAiApi', {
						method: 'GET',
						url: `${baseUrl}/models`,
						json: true,
					})) as { data?: Array<{ id?: string }> };

					const modelIds = new Set<string>(['hyai/auto']);
					const models = Array.isArray(response.data) ? response.data : [];
					for (const model of models) {
						if (typeof model.id === 'string' && model.id.trim() !== '') {
							modelIds.add(model.id);
						}
					}

					return Array.from(modelIds)
						.map((id) => ({
							name: id === 'hyai/auto' ? fallbackOption.name : id,
							value: id,
						}))
						.sort((a, b) => {
							if (a.value === 'hyai/auto') return -1;
							if (b.value === 'hyai/auto') return 1;
							return a.name.localeCompare(b.name);
						});
				} catch {
					return [fallbackOption];
				}
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'HostYourAI Chat Model',
		name: 'hostYourAiChatModel',
		subtitle: '={{$parameter["model"]}}',
		icon: {
			light: 'file:../../icons/hostyourai.svg',
			dark: 'file:../../icons/hostyourai.dark.svg',
		},
		group: ['transform'],
		version: [1],
		description: 'Use HostYourAI in AI Agent and other AI model nodes',
		defaults: {
			name: 'HostYourAI Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://hostyourai.com/app/docs',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'hostYourAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: 'hyai/auto',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				required: true,
				options: [
					{
						name: AUTO_MODEL_LABEL,
						value: 'hyai/auto',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Cold-Start Retries',
						name: 'maxColdStartRetries',
						type: 'number',
						default: DEFAULT_COLD_START_RETRIES,
						typeOptions: { minValue: 0, maxValue: 30, numberPrecision: 0 },
						description: 'Retries when HostYourAI returns 503 warmup response',
					},
					{
						displayName: 'Max Cold-Start Wait (Seconds)',
						name: 'maxColdStartWaitSeconds',
						type: 'number',
						default: DEFAULT_COLD_START_WAIT_SECONDS,
						typeOptions: { minValue: 1, maxValue: 600, numberPrecision: 0 },
						description: 'Hard cap on cumulative warmup wait',
					},
					{
						displayName: 'Policy',
						name: 'policy',
						type: 'options',
						default: 'balanced',
						displayOptions: {
							show: {
								'/model': ['hyai/auto'],
							},
						},
						description: 'HostYourAI routing policy',
						options: [
							{ name: 'Balanced', value: 'balanced' },
							{ name: 'Cost', value: 'cost' },
							{ name: 'Quality', value: 'quality' },
							{ name: 'Speed', value: 'speed' },
						],
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
						description: 'Controls randomness in model output',
					},
					{
						displayName: 'Task',
						name: 'task',
						type: 'options',
						default: 'chat',
						displayOptions: {
							show: {
								'/model': ['hyai/auto'],
							},
						},
						description: 'HostYourAI task routing hint',
						options: [
							{ name: 'Chat', value: 'chat' },
							{ name: 'Classify', value: 'classify' },
							{ name: 'Code', value: 'code' },
							{ name: 'Extract', value: 'extract' },
							{ name: 'Legal', value: 'legal' },
							{ name: 'Rag', value: 'rag' },
							{ name: 'Reason', value: 'reason' },
							{ name: 'Summarise', value: 'summarise' },
						],
					},
					{
						displayName: 'Transport',
						name: 'transport',
						type: 'options',
						default: 'body',
						displayOptions: {
							show: {
								'/model': ['hyai/auto'],
							},
						},
						description: 'Send task/policy in JSON body or request headers',
						options: [
							{ name: 'Body (HYAI Object)', value: 'body' },
							{ name: 'Headers (X-HYAI Prefix)', value: 'headers' },
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number) {
		const credentials = await this.getCredentials('hostYourAiApi');
		const rawModelName = this.getNodeParameter('model', itemIndex) as string;
		const modelName = typeof rawModelName === 'string' ? rawModelName.trim() : '';
		const options = this.getNodeParameter('options', itemIndex, {}) as ModelOptions;

		if (!modelName) {
			throw new NodeOperationError(this.getNode(), 'Model is required', { itemIndex });
		}

		const validation = validateBaseUrl(credentials.url);
		if (!validation.isValid) {
			throw new NodeOperationError(this.getNode(), `Invalid Base URL: ${validation.error}`, {
				itemIndex,
			});
		}
		const baseUrl = validation.baseUrl;

		const model = new HostYourAiChatModelClient(
			modelName,
			{
				httpRequest: async (method, url, body, headers) => {
					const requestOptions: IHttpRequestOptions = {
						method,
						url,
						body,
						headers,
						json: true,
						returnFullResponse: true,
						ignoreHttpStatusErrors: true,
					};

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'hostYourAiApi',
						requestOptions,
					);

					return {
						body: response.body,
						headers: (response.headers ?? {}) as Record<string, string | number | string[]>,
						statusCode: response.statusCode as number,
					};
				},
			},
			{
				url: baseUrl,
				temperature: options.temperature,
				task: options.task ?? 'chat',
				policy: options.policy ?? 'balanced',
				transport: options.transport ?? 'body',
				maxColdStartRetries: options.maxColdStartRetries ?? DEFAULT_COLD_START_RETRIES,
				maxColdStartWaitSeconds: options.maxColdStartWaitSeconds ?? DEFAULT_COLD_START_WAIT_SECONDS,
			},
		);

		return supplyModel(this, model);
	}
}
