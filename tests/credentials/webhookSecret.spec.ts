import { LimeCrmApi } from '../../credentials/LimeCrmApi.credentials';

describe.each([['LimeCrmApi', new LimeCrmApi()]])(
	'%s credential webhook secret field',
	(_name, credential) => {
		const field = credential.properties.find((property) => property.name === 'webhookSecret');

		it('is an optional, masked string field', () => {
			expect(field).toBeDefined();
			expect(field!.type).toBe('string');
			expect(field!.required).toBeUndefined();
			expect(field!.typeOptions?.password).toBe(true);
		});

		it('describes the expected secret length', () => {
			expect(field!.default).toBe('');
			expect(field!.description).toContain('at least 32 characters');
		});
	},
);

describe.each([['LimeCrmApi', new LimeCrmApi()]])(
	'%s credential second webhook secret field',
	(_name, credential) => {
		const field = credential.properties.find((property) => property.name === 'secondWebhookSecret');

		it('is an optional, masked string field', () => {
			expect(field).toBeDefined();
			expect(field!.type).toBe('string');
			expect(field!.required).toBeUndefined();
			expect(field!.typeOptions?.password).toBe(true);
			expect(field!.default).toBe('');
		});
	},
);

describe.each([['LimeCrmApi', new LimeCrmApi()]])(
	'%s credential active webhook secret field',
	(_name, credential) => {
		const field = credential.properties.find(
			(property) => property.name === 'activeWebhookSecretId',
		);

		it('selects one of the two secret fields, the original one by default', () => {
			expect(field).toBeDefined();
			expect(field!.type).toBe('options');
			expect(field!.default).toBe('webhookSecret');
			expect(field!.options?.map((option) => (option as { value: string }).value)).toEqual([
				'webhookSecret',
				'secondWebhookSecret',
			]);
		});
	},
);
