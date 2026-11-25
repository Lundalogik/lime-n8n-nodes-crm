import { getWebhookSecret, getWebhookSecrets } from '../../nodes/webhookSecret';

describe('getWebhookSecret', () => {
	const node = { id: '1', name: 'Trigger', type: 'limeCrmTrigger' };
	const secret = 'a'.repeat(64);
	const second = 'b'.repeat(64);

	const buildContext = (credentials: Record<string, unknown>) =>
		({
			getNode: jest.fn().mockReturnValue(node),
			getCredentials: jest.fn().mockResolvedValue(credentials),
		}) as never;

	it('returns the secret from the credential', async () => {
		await expect(
			getWebhookSecret(buildContext({ webhookSecret: secret }), 'limeCrmApi'),
		).resolves.toBe(secret);
	});

	it('returns the second secret when it is the active one', async () => {
		await expect(
			getWebhookSecret(
				buildContext({
					webhookSecret: secret,
					secondWebhookSecret: second,
					activeWebhookSecretId: 'secondWebhookSecret',
				}),
				'limeCrmApi',
			),
		).resolves.toBe(second);
	});

	it.each([[{}], [{ webhookSecret: '' }], [{ webhookSecret: '', secondWebhookSecret: second }]])(
		'fails when the credential has no webhook secret (%o)',
		async (credentials) => {
			await expect(getWebhookSecret(buildContext(credentials), 'limeCrmApi')).rejects.toThrow(
				'The credential has no Webhook Secret. Add one to the ' +
					'credential and re-activate the workflow.',
			);
		},
	);

	it('fails when the second secret is active but empty', async () => {
		await expect(
			getWebhookSecret(
				buildContext({ webhookSecret: secret, activeWebhookSecretId: 'secondWebhookSecret' }),
				'limeCrmApi',
			),
		).rejects.toThrow(
			'The credential has no Second Webhook Secret. Add one to the ' +
				'credential and re-activate the workflow.',
		);
	});
});

describe('getWebhookSecrets', () => {
	const node = { id: '1', name: 'Trigger', type: 'limeCrmTrigger' };
	const secret = 'a'.repeat(64);
	const second = 'b'.repeat(64);

	const buildContext = (credentials: Record<string, unknown>) =>
		({
			getNode: jest.fn().mockReturnValue(node),
			getCredentials: jest.fn().mockResolvedValue(credentials),
		}) as never;

	it('returns the active secret first and the other one after it', async () => {
		await expect(
			getWebhookSecrets(
				buildContext({ webhookSecret: secret, secondWebhookSecret: second }),
				'limeCrmApi',
			),
		).resolves.toEqual([secret, second]);
		await expect(
			getWebhookSecrets(
				buildContext({
					webhookSecret: secret,
					secondWebhookSecret: second,
					activeWebhookSecretId: 'secondWebhookSecret',
				}),
				'limeCrmApi',
			),
		).resolves.toEqual([second, secret]);
	});

	it.each([[{}], [{ secondWebhookSecret: '' }], [{ secondWebhookSecret: secret }]])(
		'returns only the active secret when there is no distinct other one (%o)',
		async (secondField) => {
			await expect(
				getWebhookSecrets(buildContext({ webhookSecret: secret, ...secondField }), 'limeCrmApi'),
			).resolves.toEqual([secret]);
		},
	);

	it('fails when the credential has no active webhook secret', async () => {
		await expect(
			getWebhookSecrets(buildContext({ secondWebhookSecret: second }), 'limeCrmApi'),
		).rejects.toThrow('The credential has no Webhook Secret');
	});
});
