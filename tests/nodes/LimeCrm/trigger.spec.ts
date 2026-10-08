import { createHash, createHmac, randomUUID } from 'node:crypto';
import { LimeCrmTrigger } from '../../../nodes/LimeCrm/LimeCrmTrigger.node';

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

		it('registers through the v2 API and remembers the signature version', async () => {
			const staticData: Record<string, unknown> = {};
			const httpRequestWithAuthentication = jest
				.fn()
				.mockImplementation((_credentials: string, options: { method: string; url: string }) =>
					options.method === 'GET'
						? []
						: { id: 'sub-1', events: ['deal.new'], signature_version: 'v2' },
				);

			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			await trigger.webhookMethods.default.create.call(loader as never);

			const createCall = httpRequestWithAuthentication.mock.calls.find(
				(call) => call[1].method === 'POST',
			);
			expect(createCall![1].url).toBe('api/v2/subscription/');
			expect(staticData.signatureVersion).toBe('v2');
		});

		it('falls back to the v1 API against a Lime CRM without v2', async () => {
			const staticData: Record<string, unknown> = {};
			const httpRequestWithAuthentication = jest
				.fn()
				.mockImplementation((_credentials: string, options: { method: string; url: string }) => {
					if (options.method === 'GET') {
						return [];
					}
					if (options.url === 'api/v2/subscription/') {
						throw Object.assign(new Error('Not Found'), { httpCode: '404' });
					}
					return { id: 'sub-1', events: ['deal.new'] };
				});

			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			const result = await trigger.webhookMethods.default.create.call(loader as never);

			expect(result).toBe(true);
			expect(staticData.webhookId).toBe('sub-1');
			expect(staticData.signatureVersion).toBe('v1');
			const postUrls = httpRequestWithAuthentication.mock.calls
				.filter((call) => call[1].method === 'POST')
				.map((call) => call[1].url);
			expect(postUrls).toEqual(['api/v2/subscription/', 'api/v1/subscription/']);
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

		it.each([
			['v2', { id: 'sub-1', signature_version: 'v2' }],
			['v1', { id: 'sub-1' }],
		])(
			'takes the signature version (%s) from Lime CRM for an existing subscription',
			async (expectedVersion, subscription) => {
				const staticData: Record<string, unknown> = { webhookId: 'sub-1' };
				const httpRequestWithAuthentication = jest.fn().mockResolvedValue(subscription);

				const loader = buildLoader({
					getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
					helpers: { httpRequestWithAuthentication },
				});

				const trigger = new LimeCrmTrigger();
				const result = await trigger.webhookMethods.default.checkExists.call(loader as never);

				expect(result).toBe(true);
				expect(staticData.signatureVersion).toBe(expectedVersion);
			},
		);

		it('checks a v2 subscription through the v2 API', async () => {
			const staticData: Record<string, unknown> = { webhookId: 'sub-1', signatureVersion: 'v2' };
			const httpRequestWithAuthentication = jest
				.fn()
				.mockResolvedValue({ id: 'sub-1', signature_version: 'v2' });
			const loader = buildLoader({
				getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
				helpers: { httpRequestWithAuthentication },
			});

			const trigger = new LimeCrmTrigger();
			await trigger.webhookMethods.default.checkExists.call(loader as never);

			expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
				method: 'GET',
				url: 'api/v2/subscription/sub-1',
			});
		});
	});

	describe('delete', () => {
		it.each([
			['v2', 'api/v2/subscription/sub-1/'],
			['v1', 'api/v1/subscription/sub-1/'],
		])(
			'deletes a %s subscription through its own API version and forgets it',
			async (signatureVersion, expectedUrl) => {
				const staticData: Record<string, unknown> = { webhookId: 'sub-1', signatureVersion };
				const httpRequestWithAuthentication = jest.fn().mockResolvedValue(undefined);
				const loader = buildLoader({
					getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
					helpers: { httpRequestWithAuthentication },
				});

				const trigger = new LimeCrmTrigger();
				const result = await trigger.webhookMethods.default.delete.call(loader as never);

				expect(result).toBe(true);
				expect(staticData).toEqual({});
				expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
					method: 'DELETE',
					url: expectedUrl,
				});
			},
		);
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

	describe('webhook with a version 2 subscription', () => {
		const body = { event: 'deal.new', body: { id: 1001, limetype: 'deal' } };
		const rawBody = Buffer.from(JSON.stringify(body));

		const signV2 = (secret: string, deliveryId: string, timestamp: number, data: Buffer) => {
			const bodyHash = createHash('sha256').update(data).digest('hex');
			return (
				'v2=' +
				createHmac('sha256', secret)
					.update(`v2:${deliveryId}:${timestamp}:${bodyHash}`)
					.digest('hex')
			);
		};

		const buildV2Request = (
			secret: string,
			{ timestamp = Math.floor(Date.now() / 1000), deliveryId = randomUUID() } = {},
		) => ({
			'x-lime-signature': signV2(secret, deliveryId, timestamp, rawBody),
			'x-lime-delivery-id': deliveryId,
			'x-lime-delivery-timestamp': String(timestamp),
		});

		const buildV2Loader = (headers: Record<string, string>, overrides = {}) =>
			buildLoader({
				getNode: jest.fn().mockReturnValue({ ...node, onError: 'continueRegularOutput' }),
				getWorkflowStaticData: jest
					.fn()
					.mockReturnValue({ webhookId: 'sub-1', signatureVersion: 'v2' }),
				getRequestObject: jest.fn().mockReturnValue({ rawBody }),
				getHeaderData: jest.fn().mockReturnValue(headers),
				getBodyData: jest.fn().mockReturnValue(body),
				getQueryData: jest.fn().mockReturnValue({}),
				...overrides,
			});

		// On a failed verification the trigger emits the error object itself
		const errorMessageOf = (response: { workflowData?: unknown[] }) =>
			(response.workflowData![0] as { error: { message: string } }).error.message;

		it('triggers the workflow for a valid version 2 delivery', async () => {
			const headers = buildV2Request(credentialSecret);
			const trigger = new LimeCrmTrigger();

			const response = await trigger.webhook.call(buildV2Loader(headers) as never);

			expect(response.workflowData).toEqual([[{ body, headers, query: {} }]]);
		});

		it('does not trigger the workflow twice for the same delivery', async () => {
			const headers = buildV2Request(credentialSecret);
			const trigger = new LimeCrmTrigger();

			await trigger.webhook.call(buildV2Loader(headers) as never);
			const replay = await trigger.webhook.call(buildV2Loader(headers) as never);

			expect(errorMessageOf(replay)).toBe(
				`Webhook authentication failed, delivery ${headers['x-lime-delivery-id']} was already processed`,
			);
		});

		it('rejects a delivery older than five minutes', async () => {
			const headers = buildV2Request(credentialSecret, {
				timestamp: Math.floor(Date.now() / 1000) - 301,
			});
			const trigger = new LimeCrmTrigger();

			const response = await trigger.webhook.call(buildV2Loader(headers) as never);

			expect(errorMessageOf(response)).toBe(
				'Webhook authentication failed, delivery timestamp is outside the 300s freshness window',
			);
		});

		it('rejects a tampered body', async () => {
			const headers = buildV2Request(credentialSecret);
			const tampered = Buffer.from(JSON.stringify({ ...body, body: { id: 1002 } }));
			const trigger = new LimeCrmTrigger();

			const response = await trigger.webhook.call(
				buildV2Loader(headers, {
					getRequestObject: jest.fn().mockReturnValue({ rawBody: tampered }),
				}) as never,
			);

			expect(errorMessageOf(response)).toBe(
				'Webhook authentication failed, signatures do not match',
			);
		});

		it('rejects a version 1 signature replayed to a version 2 subscription', async () => {
			const v1Signature =
				'sha256=' + createHmac('sha256', credentialSecret).update(rawBody).digest('hex');
			const trigger = new LimeCrmTrigger();

			const response = await trigger.webhook.call(
				buildV2Loader({ 'x-lime-signature': v1Signature }) as never,
			);

			expect(errorMessageOf(response)).toBe(
				'Webhook authentication failed, expected a v2 signature but received v1',
			);
		});

		it('accepts a delivery signed with the previous secret during a rotation', async () => {
			const previousSecret = 'b'.repeat(64);
			const headers = buildV2Request(previousSecret);
			const trigger = new LimeCrmTrigger();

			const response = await trigger.webhook.call(
				buildV2Loader(headers, {
					getCredentials: jest.fn().mockResolvedValue({
						url: 'https://api.example.com',
						webhookSecret: credentialSecret,
						previousWebhookSecret: previousSecret,
					}),
				}) as never,
			);

			expect(response.workflowData).toEqual([[{ body, headers, query: {} }]]);
		});
	});
});
