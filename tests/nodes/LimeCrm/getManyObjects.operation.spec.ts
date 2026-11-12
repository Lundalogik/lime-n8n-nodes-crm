import { IExecuteFunctions } from 'n8n-workflow';

jest.mock('../../../nodes/LimeCrm/transport', () => ({
	queryLimeobjects: jest.fn(),
}));

import { queryLimeobjects } from '../../../nodes/LimeCrm/transport';
import { execute } from '../../../nodes/LimeCrm/resources/data/operations/getManyObjects.operation';

const mockedQuery = queryLimeobjects as jest.Mock;

// Build an IExecuteFunctions stub whose getNodeParameter reads from a map,
// honouring the (name, index, fallback) signature used by the operation.
function makeContext(params: Record<string, unknown>): IExecuteFunctions {
	return {
		getNodeParameter: jest.fn((name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		),
	} as unknown as IExecuteFunctions;
}

const baseParams = {
	limetype: 'person',
	responseFormatInputMethod: 'json',
	responseFormatJson: '{"object":{"_id":""}}',
	orderByInputMethod: 'json',
	orderByJson: '[{"_id":"ASC"}]',
	filter: '{}',
};

// Make queryLimeobjects return a fixed-size batch for every call.
function respondWith(batchSizes: number[]) {
	let call = 0;
	mockedQuery.mockImplementation(async () => {
		const size = batchSizes[call] ?? 0;
		call += 1;
		return {
			success: true,
			data: {
				objects: Array.from({ length: size }, (_, idx) => ({
					_id: idx,
				})),
			},
		};
	});
}

// Read the offset value out of the q string passed to queryLimeobjects.
function offsetOfCall(callIndex: number): number {
	const q = mockedQuery.mock.calls[callIndex][1] as string;
	return JSON.parse(q).offset;
}

// Read the orderBy value out of the q string passed to queryLimeobjects.
function orderByOfCall(callIndex: number): unknown {
	const q = mockedQuery.mock.calls[callIndex][1] as string;
	return JSON.parse(q).orderBy;
}

beforeEach(() => {
	mockedQuery.mockReset();
});

describe('getManyObjects offset parameter', () => {
	it('starts fetching from offset 0 when offset is left empty', async () => {
		respondWith([10]);
		const context = makeContext({ ...baseParams, limit: 50, offset: '' });

		await execute.call(context, 0);

		expect(offsetOfCall(0)).toBe(0);
	});

	it('uses the provided offset as the starting offset', async () => {
		respondWith([10]);
		const context = makeContext({ ...baseParams, limit: 50, offset: 200 });

		await execute.call(context, 0);

		expect(offsetOfCall(0)).toBe(200);
	});

	it('auto-paginates forward starting from the provided offset', async () => {
		// limit 0 = unlimited, batches of 200 until a short batch ends it
		respondWith([200, 200, 50]);
		const context = makeContext({ ...baseParams, limit: 0, offset: 500 });

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(3);
		expect(offsetOfCall(0)).toBe(500);
		expect(offsetOfCall(1)).toBe(700);
		expect(offsetOfCall(2)).toBe(900);
		expect((result as unknown[]).length).toBe(450);
	});
});

describe('getManyObjects order by', () => {
	it.each([
		['an empty JSON list', { orderByInputMethod: 'json', orderByJson: '[]' }],
		['a form without fields', { orderByInputMethod: 'fields', orderByProperties: {} }],
		[
			'a form whose fields were all removed',
			{ orderByInputMethod: 'fields', orderByProperties: { orderByFields: [] } },
		],
	])('orders by _id ascending when given %s', async (_name, orderParams) => {
		respondWith([10]);
		const context = makeContext({ ...baseParams, ...orderParams, limit: 0, offset: 200 });

		await execute.call(context, 0);

		expect(offsetOfCall(0)).toBe(200);
		expect(orderByOfCall(0)).toEqual([{ _id: 'ASC' }]);
	});

	it('keeps the order given by the user', async () => {
		respondWith([10]);
		const context = makeContext({
			...baseParams,
			orderByJson: '[{"name":"DESC"}]',
			limit: 0,
			offset: 200,
		});

		await execute.call(context, 0);

		expect(orderByOfCall(0)).toEqual([{ name: 'DESC' }]);
	});
});
