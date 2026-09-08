import {
	APIResponse,
	getCreateMappingColumns,
	getUpdateMappingColumns,
	Limetype,
	LimetypeProperty,
	searchLimetypes,
	SuccessResponse,
} from '../../../nodes';
import { ILoadOptionsFunctions } from 'n8n-workflow';
import * as transport from '../../../nodes/lime-crm/transport';

const mockILoadOptionFunctions = {
	getNodeParameter: jest.fn().mockReturnValue('company'),
} as unknown as ILoadOptionsFunctions;

const propertiesResponseMock = {
	success: true,
	data: [
		{ name: 'p1', localname: 'Property 1', type: 'yesno', required: true },
		{
			name: 'p2',
			localname: 'Property 2',
			type: 'string',
			required: false,
			length: 2137,
		},
		{
			name: 'p3',
			localname: 'Property 3',
			type: 'option',
			required: true,
			options: [
				{ key: 'op1', text: 'Option 1', inactive: false },
				{ key: 'op2', text: 'Option 2', inactive: false },
				{ key: 'op3', text: 'Option 3', inactive: true },
			],
		},
	],
} as SuccessResponse<LimetypeProperty[]>;

describe('resourceMapping', () => {
	beforeEach(() => {
		jest.spyOn(transport, 'getProperties').mockResolvedValue(propertiesResponseMock);
	});
	it('gets valid resource mapping for create', async () => {
		const columns = await getCreateMappingColumns.call(mockILoadOptionFunctions);
		const property1 = columns.fields.find((p) => p.id == 'p1')!;

		expect(property1.displayName).toBe('Property 1 [yesno]');
		expect(property1.required).toBe(true);
		expect(property1.defaultMatch).toBe(false);
		expect(property1.display).toBe(true);
		expect(property1.type).toBe('boolean');
		expect(property1.options).toBe(undefined);

		const property2 = columns.fields.find((p) => p.id == 'p2')!;
		expect(property2.displayName).toBe('Property 2 [string(2137)]');
		expect(property2.required).toBe(false);
		expect(property2.defaultMatch).toBe(false);
		expect(property2.display).toBe(true);
		expect(property2.type).toBe('string');
		expect(property2.options).toBe(undefined);

		const property3 = columns.fields.find((p) => p.id == 'p3')!;
		expect(property3.displayName).toBe('Property 3 [option]');
		expect(property3.required).toBe(true);
		expect(property3.defaultMatch).toBe(false);
		expect(property3.display).toBe(true);
		expect(property3.type).toBe('options');

		const options = property3.options!;
		expect(options).toContainEqual({
			value: 'op1',
			name: 'Option 1',
		});
		expect(options).toContainEqual({
			value: 'op2',
			name: 'Option 2',
		});
		expect(options.length).toBe(2);
	});
	it('gets proper required values for update', async () => {
		const columns = await getUpdateMappingColumns.call(mockILoadOptionFunctions);
		const requiredValues = columns.fields.map((p) => p.required);
		expect(requiredValues).toEqual([false, false, false]);
	});
});

describe('searchLimetypes', () => {
	const limetypesMock = {
		success: true,
		data: [
			{
				name: 'deal',
				localname: { singular: 'Deal', plural: 'Deals' },
				properties: [],
			},
			{
				name: 'company',
				localname: { singular: 'Company', plural: 'Companies' },
				properties: [],
			},
		],
	} as SuccessResponse<Limetype[]>;

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('maps limetypes to search results sorted by display name', async () => {
		jest.spyOn(transport, 'getLimetypesFromApi').mockResolvedValue(limetypesMock);

		const result = await searchLimetypes.call(mockILoadOptionFunctions);

		expect(result.results).toEqual([
			{ name: 'Company', value: 'company' },
			{ name: 'Deal', value: 'deal' },
		]);
	});

	it('falls back to the internal name when localname is missing', async () => {
		jest.spyOn(transport, 'getLimetypesFromApi').mockResolvedValue({
			success: true,
			data: [{ name: 'helpdesk', properties: [] }],
		} as unknown as SuccessResponse<Limetype[]>);

		const result = await searchLimetypes.call(mockILoadOptionFunctions);

		expect(result.results).toEqual([{ name: 'helpdesk', value: 'helpdesk' }]);
	});

	it('returns empty results when the API call fails', async () => {
		jest.spyOn(transport, 'getLimetypesFromApi').mockResolvedValue({
			success: false,
			data: { error: {} },
		} as unknown as APIResponse<Limetype[]>);

		const result = await searchLimetypes.call(mockILoadOptionFunctions);

		expect(result.results).toEqual([]);
	});
});
