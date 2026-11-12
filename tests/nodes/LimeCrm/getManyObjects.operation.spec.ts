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
		getNode: jest.fn(() => ({ name: 'Lime CRM' })),
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

// Read the limit value out of the q string passed to queryLimeobjects.
function limitOfCall(callIndex: number): number {
	const q = mockedQuery.mock.calls[callIndex][1] as string;
	return JSON.parse(q).limit;
}

beforeEach(() => {
	mockedQuery.mockReset();
});

describe('getManyObjects batch size parameter', () => {
	it('requests 1000 objects per page when batch size is not set', async () => {
		respondWith([1000, 1000, 500]);
		const context = makeContext({ ...baseParams, limit: 2500, offset: '' });

		await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(3);
		expect(limitOfCall(0)).toBe(1000);
		expect(limitOfCall(1)).toBe(1000);
		expect(limitOfCall(2)).toBe(500);
	});

	it('requests 1000 objects per page when batch size is left empty', async () => {
		respondWith([1000, 500]);
		const context = makeContext({
			...baseParams,
			limit: 1500,
			offset: '',
			options: { batchSize: '' },
		});

		await execute.call(context, 0);

		expect(limitOfCall(0)).toBe(1000);
		expect(limitOfCall(1)).toBe(500);
	});

	it('requests the provided batch size per page', async () => {
		respondWith([500, 500, 500]);
		const context = makeContext({
			...baseParams,
			limit: 1500,
			offset: '',
			options: { batchSize: 500 },
		});

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(3);
		expect(limitOfCall(0)).toBe(500);
		expect(offsetOfCall(1)).toBe(500);
		expect(offsetOfCall(2)).toBe(1000);
		expect((result as unknown[]).length).toBe(1500);
	});

	it('uses the provided batch size when the limit is unlimited', async () => {
		respondWith([500, 400]);
		const context = makeContext({
			...baseParams,
			limit: 0,
			offset: '',
			options: { batchSize: 500 },
		});

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(2);
		expect(limitOfCall(0)).toBe(500);
		expect(limitOfCall(1)).toBe(500);
		expect((result as unknown[]).length).toBe(900);
	});

	it('requests only the limit when it is smaller than the batch size', async () => {
		respondWith([50]);
		const context = makeContext({
			...baseParams,
			limit: 50,
			offset: '',
			options: { batchSize: 1000 },
		});

		await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(1);
		expect(limitOfCall(0)).toBe(50);
	});

	it.each([0, -1, 1.5, '1000', 'abc'])('rejects batch size %p', async (batchSize) => {
		const context = makeContext({ ...baseParams, limit: 0, offset: '', options: { batchSize } });

		await expect(execute.call(context, 0)).rejects.toThrow(
			'Batch Size must be a whole number of 1 or more',
		);
		expect(mockedQuery).not.toHaveBeenCalled();
	});
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
		// limit 0 = unlimited, batches of 1000 until a short batch ends it
		respondWith([1000, 1000, 50]);
		const context = makeContext({ ...baseParams, limit: 0, offset: 500 });

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(3);
		expect(offsetOfCall(0)).toBe(500);
		expect(offsetOfCall(1)).toBe(1500);
		expect(offsetOfCall(2)).toBe(2500);
		expect((result as unknown[]).length).toBe(2050);
	});

	it.each([-1, 1.5, '200', 'abc'])('rejects offset %p', async (offset) => {
		const context = makeContext({ ...baseParams, limit: 0, offset });

		await expect(execute.call(context, 0)).rejects.toThrow(
			'Offset must be a whole number of 0 or more',
		);
		expect(mockedQuery).not.toHaveBeenCalled();
	});
});

describe('getManyObjects limit parameter', () => {
	it.each(['', null, 0])('fetches all objects when the limit is %p', async (limit) => {
		respondWith([1000, 10]);
		const context = makeContext({ ...baseParams, limit, offset: '' });

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(2);
		expect((result as unknown[]).length).toBe(1010);
	});

	it.each([-1, 1.5, '100', 'abc'])('rejects limit %p', async (limit) => {
		const context = makeContext({ ...baseParams, limit, offset: '' });

		await expect(execute.call(context, 0)).rejects.toThrow(
			'Limit must be a whole number of 0 or more',
		);
		expect(mockedQuery).not.toHaveBeenCalled();
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
