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

// Make queryLimeobjects return a fixed-size batch for every call. The _id values
// continue across batches (1, 2, 3, ...), like objects ordered by _id ascending.
function respondWith(batchSizes: number[]) {
	let call = 0;
	let nextId = 1;
	mockedQuery.mockImplementation(async () => {
		const size = batchSizes[call] ?? 0;
		call += 1;
		const objects = Array.from({ length: size }, () => ({ _id: nextId++ }));
		return { success: true, data: { objects } };
	});
}

// Make queryLimeobjects return the given objects, one list per call.
function respondWithObjects(pages: Record<string, unknown>[][]) {
	for (const objects of pages) {
		mockedQuery.mockResolvedValueOnce({ success: true, data: { objects } });
	}
}

// Read the whole query passed to queryLimeobjects.
function queryOfCall(callIndex: number) {
	return JSON.parse(mockedQuery.mock.calls[callIndex][1] as string);
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
		expect(limitOfCall(1)).toBe(500);
		expect(limitOfCall(2)).toBe(500);
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

	it('accepts the maximum batch size', async () => {
		respondWith([10]);
		const context = makeContext({
			...baseParams,
			limit: 0,
			offset: '',
			options: { batchSize: 50000 },
		});

		await execute.call(context, 0);

		expect(limitOfCall(0)).toBe(50000);
	});

	it.each([0, -1, 1.5, 50001, '1000', 'abc'])('rejects batch size %p', async (batchSize) => {
		const context = makeContext({ ...baseParams, limit: 0, offset: '', options: { batchSize } });

		await expect(execute.call(context, 0)).rejects.toThrow(
			'Batch Size must be a whole number between 1 and 50000',
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

describe('getManyObjects paging by _id', () => {
	it('pages by _id instead of offset when ordered by _id ascending', async () => {
		respondWith([200, 200, 50]);
		const context = makeContext({
			...baseParams,
			limit: 0,
			offset: '',
			options: { batchSize: 200 },
		});

		const result = await execute.call(context, 0);

		expect(mockedQuery).toHaveBeenCalledTimes(3);
		expect(queryOfCall(0).filter).toEqual({});
		expect(queryOfCall(1).filter).toEqual({ key: '_id', op: '>', exp: 200 });
		expect(queryOfCall(2).filter).toEqual({ key: '_id', op: '>', exp: 400 });
		expect([0, 1, 2].map(offsetOfCall)).toEqual([0, 0, 0]);
		expect((result as unknown[]).length).toBe(450);
	});

	it('stops at the limit when paging by _id', async () => {
		respondWith([200, 200, 50]);
		const context = makeContext({
			...baseParams,
			limit: 450,
			offset: '',
			options: { batchSize: 200 },
		});

		const result = await execute.call(context, 0);

		expect([0, 1, 2].map(limitOfCall)).toEqual([200, 200, 50]);
		expect((result as unknown[]).length).toBe(450);
	});

	it('combines the user filter with the _id condition', async () => {
		const userFilter = { key: 'company.name', op: '=?', exp: 'PERF42' };
		respondWith([200, 10]);
		const context = makeContext({
			...baseParams,
			filter: JSON.stringify(userFilter),
			limit: 0,
			offset: '',
			options: { batchSize: 200 },
		});

		await execute.call(context, 0);

		expect(queryOfCall(0).filter).toEqual(userFilter);
		expect(queryOfCall(1).filter).toEqual({
			op: 'AND',
			exp: [userFilter, { key: '_id', op: '>', exp: 200 }],
		});
	});

	it('keeps a user filter that combines conditions with OR', async () => {
		const userFilter = {
			op: 'OR',
			exp: [
				{ key: 'firstname', op: '=', exp: 'Anna' },
				{ key: 'firstname', op: '=', exp: 'Erik' },
			],
		};
		respondWith([200, 10]);
		const context = makeContext({
			...baseParams,
			filter: JSON.stringify(userFilter),
			limit: 0,
			offset: '',
			options: { batchSize: 200 },
		});

		await execute.call(context, 0);

		expect(queryOfCall(1).filter).toEqual({
			op: 'AND',
			exp: [userFilter, { key: '_id', op: '>', exp: 200 }],
		});
	});

	it.each(['DESC', 'desc'])('pages with "<" when ordered by _id %s', async (direction) => {
		respondWithObjects([[{ _id: 9 }, { _id: 8 }], [{ _id: 7 }]]);
		const context = makeContext({
			...baseParams,
			orderByJson: `[{"_id":"${direction}"}]`,
			limit: 0,
			offset: '',
			options: { batchSize: 2 },
		});

		const result = await execute.call(context, 0);

		expect(queryOfCall(1).filter).toEqual({ key: '_id', op: '<', exp: 8 });
		expect(offsetOfCall(1)).toBe(0);
		expect((result as unknown[]).length).toBe(3);
	});

	it.each([
		['another property', '[{"name":"ASC"}]'],
		['_id as a secondary order', '[{"name":"ASC"},{"_id":"ASC"}]'],
	])('pages by offset when ordered by %s', async (_name, orderByJson) => {
		respondWith([200, 10]);
		const context = makeContext({
			...baseParams,
			orderByJson,
			limit: 0,
			offset: '',
			options: { batchSize: 200 },
		});

		await execute.call(context, 0);

		expect(queryOfCall(1).filter).toEqual({});
		expect(offsetOfCall(1)).toBe(200);
	});

	it('pages by offset when the user sets a starting offset', async () => {
		respondWith([200, 10]);
		const context = makeContext({
			...baseParams,
			limit: 0,
			offset: 400,
			options: { batchSize: 200 },
		});

		await execute.call(context, 0);

		expect(queryOfCall(1).filter).toEqual({});
		expect(offsetOfCall(1)).toBe(600);
	});

	it('pages by offset when _id is returned under an alias', async () => {
		respondWith([200, 10]);
		const context = makeContext({
			...baseParams,
			responseFormatJson: '{"object":{"_id":{"_alias":"id"}}}',
			limit: 0,
			offset: '',
			options: { batchSize: 200 },
		});

		await execute.call(context, 0);

		expect(offsetOfCall(1)).toBe(200);
	});

	it.each([
		['instead of _id', '{"object":{"firstname":{"_alias":"_id"}}}'],
		['next to _id', '{"object":{"_id":"","firstname":{"_alias":"_id"}}}'],
	])('pages by offset when another property is returned as _id %s', async (_name, format) => {
		respondWithObjects([[{ _id: 'Anna' }, { _id: 'Erik' }], [{ _id: 'Olle' }]]);
		const context = makeContext({
			...baseParams,
			responseFormatJson: format,
			limit: 0,
			offset: '',
			options: { batchSize: 2 },
		});

		const result = await execute.call(context, 0);

		expect(queryOfCall(0).responseFormat).toEqual(JSON.parse(format));
		expect(queryOfCall(1).filter).toEqual({});
		expect(offsetOfCall(1)).toBe(2);
		expect(result).toEqual([{ _id: 'Anna' }, { _id: 'Erik' }, { _id: 'Olle' }]);
	});

	it('requests _id when the response format leaves it out, and removes it from the output', async () => {
		respondWithObjects([
			[
				{ _id: 1, name: 'a' },
				{ _id: 2, name: 'b' },
			],
			[{ _id: 3, name: 'c' }],
		]);
		const context = makeContext({
			...baseParams,
			responseFormatJson: '{"object":{"name":""}}',
			limit: 0,
			offset: '',
			options: { batchSize: 2 },
		});

		const result = await execute.call(context, 0);

		expect(queryOfCall(0).responseFormat).toEqual({ object: { name: '', _id: '' } });
		expect(queryOfCall(1).filter).toEqual({ key: '_id', op: '>', exp: 2 });
		expect(result).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
	});

	it('keeps _id in the output when the response format asks for it', async () => {
		respondWithObjects([[{ _id: 1, name: 'a' }]]);
		const context = makeContext({
			...baseParams,
			responseFormatJson: '{"object":{"_id":"","name":""}}',
			limit: 0,
			offset: '',
		});

		const result = await execute.call(context, 0);

		expect(queryOfCall(0).responseFormat).toEqual({ object: { _id: '', name: '' } });
		expect(result).toEqual([{ _id: 1, name: 'a' }]);
	});
});
