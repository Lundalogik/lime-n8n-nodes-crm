import { INode } from 'n8n-workflow';
import { verifyHmac, verifyRequest } from '../../nodes/crypto';

describe('hmac', () => {
	const key = 'my-secret-key';
	const data = Buffer.from('hello world');
	const correctHmac = 'sha256=90eb182d8396f16d4341d582047f45c0a97d73388c5377d9ced478a2212295ad';
	const sameLengthWrongHmac = correctHmac.slice(0, -1) + 'e';
	const truncatedHmac = correctHmac.slice(0, -1);

	describe('verifyHmac', () => {
		it('returns true when the HMAC matches', () => {
			expect(verifyHmac(key, data, correctHmac)).toBe(true);
		});

		it('returns false when the HMAC does not match', () => {
			expect(verifyHmac(key, data, 'wrongHmac')).toBe(false);
		});

		it('returns false when the HMAC has the same length but differs', () => {
			expect(verifyHmac(key, data, sameLengthWrongHmac)).toBe(false);
		});

		it('returns false for an empty HMAC', () => {
			expect(verifyHmac(key, data, '')).toBe(false);
		});
	});

	describe('verifyRequest', () => {
		const node: INode = {
			id: '1',
			name: 'Lime CRM Trigger',
			type: 'limeCrmTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		};

		it('does not throw for a matching signature', () => {
			expect(() => verifyRequest(node, correctHmac, key, data)).not.toThrow();
		});

		it('throws when the signature is missing', () => {
			expect(() => verifyRequest(node, '', key, data)).toThrow(
				'Webhook authentication failed, signature key is missing while secret is present!',
			);
		});

		it('throws for a same-length signature that does not match', () => {
			expect(() => verifyRequest(node, sameLengthWrongHmac, key, data)).toThrow(
				'Webhook authentication failed, signatures do not match',
			);
		});

		it('throws for a truncated signature', () => {
			expect(() => verifyRequest(node, truncatedHmac, key, data)).toThrow(
				'Webhook authentication failed, signatures do not match',
			);
		});
	});
});
