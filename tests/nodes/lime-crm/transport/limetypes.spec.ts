import * as commons from '../../../../nodes/lime-crm/transport/commons';
import {
	getLimetype,
	getLimetypesFromApi,
	getProperties,
} from '../../../../nodes/lime-crm/transport/limetypes';
import { makeNodeExecuteContext } from '../helpers';

const callLimeApiMock = jest.spyOn(commons, 'callLimeApi') as unknown as jest.Mock;

const ok = <T>(data: T) => ({ success: true, data });
const errorEnvelope = {
	success: false,
	data: { error: { message: 'boom' } },
};

const rawLimetype = {
	name: 'person',
	localname: { singular: 'Person', plural: 'Persons' },
	_links: { self: { href: '/api/v1/limetype/person/' } },
	_embedded: {
		properties: [
			{
				name: 'name',
				type: 'string',
				_links: { self: { href: '/x' } },
			},
		],
	},
};

const ctx = makeNodeExecuteContext({});

beforeEach(() => {
	callLimeApiMock.mockReset();
});

describe('getLimetypesFromApi', () => {
	it('deserializes each limetype, stripping API metadata', async () => {
		callLimeApiMock.mockResolvedValue(ok({ _embedded: { limetypes: [rawLimetype] } }));

		const response = await getLimetypesFromApi(ctx);

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/api/v1/limetype/',
			requestOptions: { qs: { _embed: 'limetypes.properties' } },
		});
		expect(response).toEqual(
			ok([
				{
					name: 'person',
					localname: { singular: 'Person', plural: 'Persons' },
					properties: [{ name: 'name', type: 'string' }],
				},
			]),
		);
	});

	it('returns an empty list when the response has no embedded limetypes', async () => {
		callLimeApiMock.mockResolvedValue(ok({}));

		const response = await getLimetypesFromApi(ctx);

		expect(response).toEqual(ok([]));
	});

	it('passes an error envelope through unchanged', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		const response = await getLimetypesFromApi(ctx);

		expect(response).toBe(errorEnvelope);
	});
});

describe('getLimetype', () => {
	it('fetches and deserializes a single limetype', async () => {
		callLimeApiMock.mockResolvedValue(ok(rawLimetype));

		const response = await getLimetype(ctx, 'person');

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/api/v1/limetype/person/',
			requestOptions: { qs: { _embed: 'properties' } },
		});
		expect(response).toEqual(
			ok({
				name: 'person',
				localname: { singular: 'Person', plural: 'Persons' },
				properties: [{ name: 'name', type: 'string' }],
			}),
		);
	});

	it('passes an error envelope through unchanged', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		const response = await getLimetype(ctx, 'person');

		expect(response).toBe(errorEnvelope);
	});
});

describe('getProperties', () => {
	it('deserializes properties and resolves the related limetype from _links', async () => {
		callLimeApiMock.mockResolvedValue(
			ok({
				_embedded: {
					properties: [
						{
							name: 'name',
							type: 'string',
							_links: { self: { href: '/x' } },
						},
						{
							name: 'company',
							type: 'belongsto',
							_links: { related_type: { name: 'company' } },
						},
					],
				},
			}),
		);

		const response = await getProperties(ctx, 'person');

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/api/v1/limetype/person/',
			requestOptions: { qs: { _embed: 'properties' } },
			errorMetadata: { limetype: 'person' },
		});
		// relatedLimetype only appears on properties whose _links carry a
		// related_type; _links itself is always stripped.
		expect(response).toEqual(
			ok([
				{ name: 'name', type: 'string' },
				{
					name: 'company',
					type: 'belongsto',
					relatedLimetype: 'company',
				},
			]),
		);
	});

	it('returns an empty list when the response has no embedded properties', async () => {
		callLimeApiMock.mockResolvedValue(ok({}));

		const response = await getProperties(ctx, 'person');

		expect(response).toEqual(ok([]));
	});

	it('passes an error envelope through unchanged', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		const response = await getProperties(ctx, 'person');

		expect(response).toBe(errorEnvelope);
	});
});
