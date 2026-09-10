import { createHmac } from 'node:crypto';
import { LimeCrmTrigger } from '../../../nodes/lime-crm/LimeCrmTrigger.node';

describe('LimeCrmTrigger webhook secret handling', () => {
	const node = {
		id: '1',
		name: 'Lime CRM Trigger',
		type: 'limeCrmTrigger',
	};

	const credentialSecret = 'a'.repeat(64);

	const buildLoader = (overrides: Record<string, unknown> = {}) => ({
		getNode: jest.fn().mockReturnValue(node),
		getWorkflow: jest.fn().mockReturnValue({ id: 'wf', name: 'Workflow' }),
		getInstanceId: jest.fn().mockReturnValue('instance-id'),
		getExecutionId: jest.fn().mockReturnValue('exec-id'),
		getMode: jest.fn().mockReturnValue('manual'),
		getNodeParameter: jest.fn().mockReturnValue({
			event: [{ limetype: 'deal', eventType: 'new' }],
		}),
		getNodeWebhookUrl: jest.fn().mockReturnValue('https://n8n.example.com/webhook'),
		getCredentials: jest.fn().mockResolvedValue({
			url: 'https://api.example.com',
			webhookSecret: credentialSecret,
		}),
		helpers: {
			returnJsonArray: jest.fn((data: unknown) => data),
		},
		...overrides,
	});

	describe('create', () => {
		it('sends the credential secret to Lime CRM without persisting it in static data', async () => {
			const staticData: Record<string, unknown> = {};
			const httpRequestWithAuthentication = jest
				.fn()
				.mockImplementation((_credentials: string, options: { method: string }) =>
					options.method === 'GET' ? [] : { id: 'sub-1', events: ['deal.new'] },
				);

			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			const result = await trigger.webhookMethods.default.create.call(loader as never);

			expect(result).toBe(true);
			expect(staticData.webhookId).toBe('sub-1');

			const createCall = httpRequestWithAuthentication.mock.calls.find(
				(call) => call[1].method === 'POST',
			);
			const sentBody = createCall![1].body as { secret: string };
			// The secret handed to Lime CRM is the one from the credential
			// and no copy of it ends up in the workflow static data.
			expect(sentBody.secret).toBe(credentialSecret);
			expect(staticData.webhookSecret).toBeUndefined();
		});

		it('fails when the credential has no webhook secret', async () => {
			const httpRequestWithAuthentication = jest.fn().mockResolvedValue([]);

			const loader = buildLoader({
				getCredentials: jest.fn().mockResolvedValue({ url: 'https://api.example.com' }),
				getWorkflowStaticData: jest.fn().mockReturnValue({}),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			await expect(trigger.webhookMethods.default.create.call(loader as never)).rejects.toThrow(
				'The credential has no Webhook Secret. Add one to the ' +
					'credential and re-activate the workflow.',
			);
		});
	});

	describe('checkExists', () => {
		it('re-registers webhooks that still have a legacy secret in static data', async () => {
			const staticData: Record<string, unknown> = {
				webhookId: 'sub-1',
				webhookSecret: 'legacy-encrypted-blob',
			};
			const httpRequestWithAuthentication = jest.fn();

			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			const result = await trigger.webhookMethods.default.checkExists.call(loader as never);

			// Reported as missing so `create` re-registers the webhook with
			// the secret from the credential.
			expect(result).toBe(false);
			expect(staticData.webhookSecret).toBeUndefined();
			expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
		});
	});

	describe('webhook', () => {
		const buildSignedRequest = (secret: string) => {
			const body = {
				event: 'deal.new',
				body: { id: 1001, limetype: 'deal' },
			};
			const rawBody = Buffer.from(JSON.stringify(body));
			const signature = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
			return { body, rawBody, signature };
		};

		it('validates the signature using the credential secret', async () => {
			const { body, rawBody, signature } = buildSignedRequest(credentialSecret);

			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue({ webhookId: 'sub-1' }),
				getRequestObject: jest.fn().mockReturnValue({ rawBody }),
				getHeaderData: jest.fn().mockReturnValue({ 'x-lime-signature': signature }),
				getBodyData: jest.fn().mockReturnValue(body),
				getQueryData: jest.fn().mockReturnValue({}),
			});

			const trigger = new LimeCrmTrigger();
			const response = await trigger.webhook.call(loader as never);

			expect(response.workflowData).toEqual([
				[
					{
						body,
						headers: { 'x-lime-signature': signature },
						query: {},
					},
				],
			]);
		});

		it('throws when the credential has no webhook secret', async () => {
			const { body, rawBody, signature } = buildSignedRequest(credentialSecret);

			const loader = buildLoader({
				getCredentials: jest.fn().mockResolvedValue({ url: 'https://api.example.com' }),
				getWorkflowStaticData: jest.fn().mockReturnValue({ webhookId: 'sub-1' }),
				getRequestObject: jest.fn().mockReturnValue({ rawBody }),
				getHeaderData: jest.fn().mockReturnValue({ 'x-lime-signature': signature }),
				getBodyData: jest.fn().mockReturnValue(body),
				getQueryData: jest.fn().mockReturnValue({}),
			});

			const trigger = new LimeCrmTrigger();
			await expect(trigger.webhook.call(loader as never)).rejects.toThrow(
				'The credential has no Webhook Secret. Add one to the ' +
					'credential and re-activate the workflow.',
			);
		});
	});
});
