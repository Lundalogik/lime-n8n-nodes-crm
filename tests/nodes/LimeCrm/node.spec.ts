// End-to-end tests for LimeCrm.execute(): resource/operation dispatch,
// per-item looping, operation orchestration and output shaping.
//
// We mock only the transport layer so the real operations, resource
// dispatchers and node execute run.

jest.mock('../../../nodes/LimeCrm/transport', () => ({
	getLimetype: jest.fn(),
	getLimetypesFromApi: jest.fn(),
	getProperties: jest.fn(),
	createLimeobject: jest.fn(),
	getLimeobject: jest.fn(),
	updateLimeobject: jest.fn(),
	deleteLimeobject: jest.fn(),
	queryLimeobjects: jest.fn(),
	getFileContent: jest.fn(),
	getFileContentByLimetype: jest.fn(),
	getFileMetadata: jest.fn(),
	getFileMetadataByLimeobject: jest.fn(),
	createFile: jest.fn(),
	fetchManyUsers: jest.fn(),
	fetchSingleUserById: jest.fn(),
	fetchSingleUserByLimeobjectId: jest.fn(),
	createBulkImportJob: jest.fn(),
	uploadBulkImportData: jest.fn(),
	getBulkImportJobStatus: jest.fn(),
	waitForBulkImportJob: jest.fn(),
	// Used by LimeCrmTrigger, which loads together with the node module.
	getSubscription: jest.fn(),
	listSubscriptionsWithExistingData: jest.fn(),
	createSubscription: jest.fn(),
	deleteSubscription: jest.fn(),
}));

import { IBinaryData, NodeOperationError } from 'n8n-workflow';
import { LimeCrm } from '../../../nodes/LimeCrm/LimeCrm.node';
import { DEFAULT_API_OBJECT_LIMIT } from '../../../nodes/LimeCrm/models';
import { makeNodeExecuteContext, transportMock } from './helpers';

const ok = <T>(data: T) => ({ success: true, data });
const apiError = (message: string) => ({
	success: false,
	data: { error: { message } },
});

const node = new LimeCrm();

beforeEach(() => {
	jest.clearAllMocks();
});

describe('LimeCrm execute — metadata resource', () => {
	it('getAllLimetypes returns one item per limetype', async () => {
		transportMock.getLimetypesFromApi.mockResolvedValue(
			ok([{ name: 'person' }, { name: 'company' }]) as never,
		);
		const ctx = makeNodeExecuteContext({
			resource: 'metadata',
			operation: 'getAllLimetypes',
		});

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([{ json: { name: 'person' } }, { json: { name: 'company' } }]);
	});

	it('getSingleLimetype fetches the requested limetype', async () => {
		transportMock.getLimetype.mockResolvedValue(ok({ name: 'person', properties: [] }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'metadata',
			operation: 'getSingleLimetype',
			limetype: 'person',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getLimetype).toHaveBeenCalledWith(ctx, 'person');
		expect(out[0]).toEqual([{ json: { name: 'person', properties: [] } }]);
	});

	it('getSingleFileMetadata fetches by file id', async () => {
		transportMock.getFileMetadata.mockResolvedValue(ok({ id: 'f1', filename: 'cv.pdf' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'metadata',
			operation: 'getSingleFileMetadata',
			source: 'byFile',
			identifier: 'f1',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getFileMetadata).toHaveBeenCalledWith(ctx, 'f1');
		expect(out[0]).toEqual([{ json: { id: 'f1', filename: 'cv.pdf' } }]);
	});

	it('getSingleFileMetadata fetches via limeobject and property', async () => {
		transportMock.getFileMetadataByLimeobject.mockResolvedValue(ok({ id: 'f1' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'metadata',
			operation: 'getSingleFileMetadata',
			source: 'byLimeobject',
			identifier: '42',
			limetype: 'person',
			property: 'document',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getFileMetadataByLimeobject).toHaveBeenCalledWith(
			ctx,
			'person',
			'42',
			'document',
		);
		expect(out[0]).toEqual([{ json: { id: 'f1' } }]);
	});

	it('getSingleFileMetadata returns an error envelope for an unknown source when errors continue', async () => {
		const ctx = makeNodeExecuteContext(
			{
				resource: 'metadata',
				operation: 'getSingleFileMetadata',
				source: 'bogus',
				identifier: 'f1',
			},
			{ onError: 'continueRegularOutput' },
		);

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([
			{
				json: {
					error: { message: 'The source "bogus" is not supported' },
				},
			},
		]);
	});
});

describe('LimeCrm execute — data resource', () => {
	it('createSingleObject creates from JSON input', async () => {
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1, name: 'Jane' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'json',
			objectJson: '{"name":"Jane"}',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', { name: 'Jane' });
		expect(out[0]).toEqual([{ json: { _id: 1, name: 'Jane' } }]);
	});

	it('createSingleObject creates from resource mapper fields', async () => {
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1, name: 'Jane' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'fields',
			properties: { value: { name: 'Jane' }, schema: [] },
		});

		await node.execute.call(ctx);

		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', { name: 'Jane' });
	});

	it('createSingleObject uploads binary file properties before creating', async () => {
		const binaryData = {
			data: 'YmluYXJ5',
			mimeType: 'application/pdf',
			fileName: 'cv.pdf',
		} as IBinaryData;
		transportMock.getProperties.mockResolvedValue(
			ok([{ name: 'document', type: 'file' }]) as never,
		);
		transportMock.createFile.mockResolvedValue(ok({ id: 'file_9' }) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1, document: 'file_9' }) as never);
		transportMock.getFileMetadata.mockResolvedValue(
			ok({ id: 'file_9', filename: 'cv.pdf' }) as never,
		);
		const ctx = makeNodeExecuteContext(
			{
				resource: 'data',
				operation: 'createSingleObject',
				limetype: 'person',
				inputMethod: 'json',
				objectJson: '{"name":"Jane","document":"data"}',
			},
			{ binaryData },
		);

		const out = await node.execute.call(ctx);

		// The binary property value is replaced by the uploaded file id...
		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', {
			name: 'Jane',
			document: 'file_9',
		});
		// ...and the response resolves the file id to its metadata.
		expect(out[0]).toEqual([
			{
				json: {
					_id: 1,
					document: { id: 'file_9', filename: 'cv.pdf' },
				},
			},
		]);
	});

	it('createSingleObject passes an API error envelope through as item json', async () => {
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		transportMock.createLimeobject.mockResolvedValue(apiError('boom') as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'json',
			objectJson: '{"name":"Jane"}',
		});

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([{ json: { error: { message: 'boom' } } }]);
	});

	it('getSingleObject fetches an object by id', async () => {
		transportMock.getLimeobject.mockResolvedValue(ok({ _id: '5', name: 'Acme' }) as never);
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getSingleObject',
			limetype: 'company',
			objectId: '5',
			includeFileContent: false,
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getLimeobject).toHaveBeenCalledWith(ctx, 'company', '5');
		expect(out[0]).toEqual([{ json: { _id: '5', name: 'Acme' }, binary: {} }]);
	});

	it('updateSingleObject updates from JSON input', async () => {
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		transportMock.updateLimeobject.mockResolvedValue(ok({ _id: '5', name: 'New name' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'updateSingleObject',
			limetype: 'company',
			id: '5',
			inputType: 'json',
			jsonData: '{"name":"New name"}',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.updateLimeobject).toHaveBeenCalledWith(ctx, 'company', '5', {
			name: 'New name',
		});
		expect(out[0]).toEqual([{ json: { _id: '5', name: 'New name' }, binary: {} }]);
	});

	it('deleteSingleObject deletes an object by id', async () => {
		transportMock.deleteLimeobject.mockResolvedValue(ok({}) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'deleteSingleObject',
			limetype: 'company',
			objectId: '5',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.deleteLimeobject).toHaveBeenCalledWith(ctx, 'company', '5');
		expect(out[0]).toEqual([{ json: {} }]);
	});

	it('getManyObjects returns one item per fetched object', async () => {
		transportMock.queryLimeobjects.mockResolvedValue(
			ok({ objects: [{ _id: 1 }, { _id: 2 }] }) as never,
		);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getManyObjects',
			limetype: 'person',
			responseFormatInputMethod: 'json',
			responseFormatJson: '{"object":{"_id":""}}',
			orderByInputMethod: 'json',
			orderByJson: '[{"_id":"ASC"}]',
			filter: '{}',
			limit: 50,
			offset: 0,
		});

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([{ json: { _id: 1 } }, { json: { _id: 2 } }]);
	});

	it('getManyObjects returns the error envelope as a single item on query failure', async () => {
		transportMock.queryLimeobjects.mockResolvedValue(apiError('bad filter') as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getManyObjects',
			limetype: 'person',
			responseFormatInputMethod: 'json',
			responseFormatJson: '{"object":{"_id":""}}',
			orderByInputMethod: 'json',
			orderByJson: '[{"_id":"ASC"}]',
			filter: '{}',
			limit: 50,
			offset: 0,
		});

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([{ json: { error: { message: 'bad filter' } } }]);
	});

	it('getSingleFile returns the file content as binary data', async () => {
		const binary = { data: 'YmluYXJ5', mimeType: 'application/pdf' };
		transportMock.getFileContent.mockResolvedValue(ok(binary) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getSingleFile',
			source: 'byFile',
			identifier: 'f1',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getFileContent).toHaveBeenCalledWith(ctx, 'f1');
		expect(out[0]).toEqual([{ json: {}, binary: { data: binary } }]);
	});

	it('getSingleFile fetches via limeobject and property', async () => {
		const binary = { data: 'YmluYXJ5', mimeType: 'application/pdf' };
		transportMock.getFileContentByLimetype.mockResolvedValue(ok(binary) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getSingleFile',
			source: 'byLimeobject',
			identifier: '42',
			limetype: 'person',
			property: 'document',
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.getFileContentByLimetype).toHaveBeenCalledWith(
			ctx,
			'person',
			'42',
			'document',
		);
		expect(out[0]).toEqual([{ json: {}, binary: { data: binary } }]);
	});

	it('getSingleFile passes an API error envelope through as item json', async () => {
		transportMock.getFileContent.mockResolvedValue(apiError('not found') as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getSingleFile',
			source: 'byFile',
			identifier: 'f1',
		});

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([{ json: { error: { message: 'not found' } } }]);
	});

	it('getSingleFile throws for an unknown source', async () => {
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'getSingleFile',
			source: 'bogus',
			identifier: 'f1',
		});

		await expect(node.execute.call(ctx)).rejects.toThrow('The source "bogus" is not supported!');
	});
});

describe('LimeCrm execute — bulk import operations', () => {
	const completedJob = {
		status: 'completed',
		startedAt: '2026-01-01T00:00:00Z',
		endedAt: '2026-01-01T00:01:00Z',
		result: { total: 3, created: 3, updated: 0, skipped: 0, failed: 0 },
		extras: { task_id: 'task-9' },
	};

	function makeBulkContext(
		operation: string,
		extraParams: Record<string, unknown> = {},
		overrides?: { continueOnFail?: boolean },
	) {
		return makeNodeExecuteContext(
			{
				resource: 'data',
				operation,
				limetype: 'person',
				inputMethod: 'json',
				objectJson: (i: number) => JSON.stringify({ name: `obj${i}` }),
				...extraParams,
			},
			{
				inputItems: [{ json: {} }, { json: {} }, { json: {} }],
				...overrides,
			},
		);
	}

	it.each([
		['bulkCreateManyObjects', 'create'],
		['bulkUpdateManyObjects', 'update'],
		['bulkCreateOrUpdateManyObjects', 'create_or_update'],
	])('%s creates a job in "%s" mode', async (operation, mode) => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue(completedJob as never);
		const ctx = makeBulkContext(operation, { matchingProperty: 'email' });

		await node.execute.call(ctx);

		expect(transportMock.createBulkImportJob).toHaveBeenCalledWith(ctx, {
			mode,
			limetype: 'person',
			matchingProperty: 'email',
			properties: ['name'],
		});
	});

	it('runs a single job for the whole input batch and returns one summary item', async () => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue(completedJob as never);
		const ctx = makeBulkContext('bulkCreateManyObjects');

		const out = await node.execute.call(ctx);

		expect(transportMock.createBulkImportJob).toHaveBeenCalledTimes(1);
		expect(transportMock.uploadBulkImportData).toHaveBeenCalledWith(ctx, 'job1', [
			{ values: { name: 'obj0' } },
			{ values: { name: 'obj1' } },
			{ values: { name: 'obj2' } },
		]);
		expect(out[0]).toEqual([
			{
				json: {
					jobId: 'job1',
					status: 'completed',
					startedAt: '2026-01-01T00:00:00Z',
					finishedAt: '2026-01-01T00:01:00Z',
					summary: completedJob.result,
					taskId: 'task-9',
				},
			},
		]);
	});

	it('omits an empty matching property from the job payload', async () => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue(completedJob as never);
		const ctx = makeBulkContext('bulkCreateManyObjects');

		await node.execute.call(ctx);

		const payload = transportMock.createBulkImportJob.mock.calls[0][1];
		expect(payload).not.toHaveProperty('matchingProperty');
	});

	it('throws when the bulk import job fails', async () => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue({
			status: 'failed',
		} as never);
		const ctx = makeBulkContext('bulkCreateManyObjects');

		await expect(node.execute.call(ctx)).rejects.toThrow('The bulk import job failed');
	});

	it('wraps every entry of a top-level array and reads the field once', async () => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue(completedJob as never);
		const ctx = makeBulkContext('bulkCreateManyObjects', {
			limetype: 'company',
			objectJson: JSON.stringify([
				{ name: 'Company A', maps_latitude: 1 },
				{ name: 'Company B', maps_latitude: 2 },
			]),
		});

		await node.execute.call(ctx);

		// Three input items, but the array is the whole payload: two objects
		expect(transportMock.uploadBulkImportData).toHaveBeenCalledWith(ctx, 'job1', [
			{ values: { name: 'Company A', maps_latitude: 1 } },
			{ values: { name: 'Company B', maps_latitude: 2 } },
		]);
		expect(transportMock.createBulkImportJob.mock.calls[0][1].properties).toEqual([
			'name',
			'maps_latitude',
		]);
	});

	it('imports every input item in form mode', async () => {
		transportMock.createBulkImportJob.mockResolvedValue({
			id: 'job1',
		} as never);
		transportMock.waitForBulkImportJob.mockResolvedValue(completedJob as never);
		const ctx = makeBulkContext('bulkCreateManyObjects', {
			inputMethod: 'fields',
			properties: (i: number) => ({
				value: { name: `row${i}` },
				schema: [{ id: 'name', type: 'string' }],
			}),
			relationLookups: { value: {}, schema: [] },
		});

		await node.execute.call(ctx);

		expect(transportMock.uploadBulkImportData).toHaveBeenCalledWith(ctx, 'job1', [
			{ values: { name: 'row0' } },
			{ values: { name: 'row1' } },
			{ values: { name: 'row2' } },
		]);
	});
});

describe('LimeCrm execute — admin resource', () => {
	it('getSingleUser fetches by user id', async () => {
		transportMock.fetchSingleUserById.mockResolvedValue(
			ok({ id: 'u1', username: 'jane' }) as never,
		);
		const ctx = makeNodeExecuteContext({
			resource: 'admin',
			operation: 'getSingleUser',
			source: 'byUser',
			identifier: 'u1',
			withCoworker: true,
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.fetchSingleUserById).toHaveBeenCalledWith(ctx, 'u1', true);
		expect(out[0]).toEqual([{ json: { id: 'u1', username: 'jane' } }]);
	});

	it('getSingleUser fetches by limeobject id', async () => {
		transportMock.fetchSingleUserByLimeobjectId.mockResolvedValue(ok({ id: 'u1' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'admin',
			operation: 'getSingleUser',
			source: 'byLimeobject',
			identifier: '42',
			withCoworker: false,
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.fetchSingleUserByLimeobjectId).toHaveBeenCalledWith(ctx, '42', false);
		expect(out[0]).toEqual([{ json: { id: 'u1' } }]);
	});

	it('getManyUsers returns one item per user', async () => {
		transportMock.fetchManyUsers.mockResolvedValue(ok([{ id: 'u1' }, { id: 'u2' }]) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'admin',
			operation: 'getManyUsers',
			active: true,
			userType: 'regular',
			limit: 25,
			withCoworker: false,
		});

		const out = await node.execute.call(ctx);

		expect(transportMock.fetchManyUsers).toHaveBeenCalledWith(ctx, true, 'regular', 25, false);
		expect(out[0]).toEqual([{ json: { id: 'u1' } }, { json: { id: 'u2' } }]);
	});

	it('getManyUsers falls back to the default limit when limit is 0', async () => {
		transportMock.fetchManyUsers.mockResolvedValue(ok([]) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'admin',
			operation: 'getManyUsers',
			active: true,
			userType: 'regular',
			limit: 0,
			withCoworker: false,
		});

		await node.execute.call(ctx);

		expect(transportMock.fetchManyUsers).toHaveBeenCalledWith(
			ctx,
			true,
			'regular',
			DEFAULT_API_OBJECT_LIMIT,
			false,
		);
	});
});

describe('LimeCrm execute — dispatch and error handling', () => {
	it('throws a NodeOperationError for an unknown operation', async () => {
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'frobnicate',
		});

		await expect(node.execute.call(ctx)).rejects.toThrow(NodeOperationError);
		await expect(node.execute.call(ctx)).rejects.toThrow(
			'The operation "frobnicate" is not supported!',
		);
	});

	it('turns per-item failures into error items when continueOnFail is on', async () => {
		const ctx = makeNodeExecuteContext(
			{ resource: 'data', operation: 'frobnicate' },
			{ continueOnFail: true },
		);

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([
			{
				json: {},
				error: 'The operation "frobnicate" is not supported!',
				pairedItem: { item: 0 },
			},
		]);
	});

	it('returns an empty output for an unknown resource (current behavior)', async () => {
		const ctx = makeNodeExecuteContext({
			resource: 'bogus',
			operation: 'getManyObjects',
		});

		const out = await node.execute.call(ctx);

		expect(out).toEqual([[]]);
	});

	it('executes the operation once per input item', async () => {
		transportMock.getLimeobject.mockResolvedValue(ok({ _id: 'x' }) as never);
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		const ctx = makeNodeExecuteContext(
			{
				resource: 'data',
				operation: 'getSingleObject',
				limetype: 'person',
				objectId: (i: number) => `id${i}`,
				includeFileContent: false,
			},
			{ inputItems: [{ json: {} }, { json: {} }] },
		);

		const out = await node.execute.call(ctx);

		expect(transportMock.getLimeobject).toHaveBeenNthCalledWith(1, ctx, 'person', 'id0');
		expect(transportMock.getLimeobject).toHaveBeenNthCalledWith(2, ctx, 'person', 'id1');
		expect(out[0]).toHaveLength(2);
	});

	it('keeps processing remaining items after a failure when continueOnFail is on', async () => {
		transportMock.getLimeobject
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce(ok({ _id: '2' }) as never);
		transportMock.getProperties.mockResolvedValue(ok([]) as never);
		const ctx = makeNodeExecuteContext(
			{
				resource: 'data',
				operation: 'getSingleObject',
				limetype: 'person',
				objectId: 'id',
				includeFileContent: false,
			},
			{
				inputItems: [{ json: {} }, { json: {} }],
				continueOnFail: true,
			},
		);

		const out = await node.execute.call(ctx);

		expect(out[0]).toEqual([
			{ json: {}, error: 'boom', pairedItem: { item: 0 } },
			{ json: { _id: '2' }, binary: {} },
		]);
	});
});

describe('LimeCrmNode execute — accept null for texts', () => {
	const personProperties = [
		{ name: 'name', type: 'string' },
		{ name: 'notes', type: 'text' },
		{ name: 'age', type: 'integer' },
	];

	it('createSingleObject sends empty strings for null text values by default', async () => {
		transportMock.getProperties.mockResolvedValue(ok(personProperties) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1 }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'json',
			objectJson: '{"name":null,"notes":null,"age":null}',
		});

		await node.execute.call(ctx);

		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', {
			name: '',
			notes: '',
			age: null,
		});
	});

	it('createSingleObject applies the toggle to resource mapper input as well', async () => {
		transportMock.getProperties.mockResolvedValue(ok(personProperties) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1 }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'fields',
			properties: { value: { name: null, age: 30 }, schema: [] },
			acceptNullForTexts: true,
		});

		await node.execute.call(ctx);

		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', {
			name: '',
			age: 30,
		});
	});

	it('createSingleObject passes null through when the toggle is off', async () => {
		transportMock.getProperties.mockResolvedValue(ok(personProperties) as never);
		transportMock.createLimeobject.mockResolvedValue(ok({ _id: 1 }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'createSingleObject',
			limetype: 'person',
			inputMethod: 'json',
			objectJson: '{"name":null}',
			acceptNullForTexts: false,
		});

		await node.execute.call(ctx);

		expect(transportMock.createLimeobject).toHaveBeenCalledWith(ctx, 'person', { name: null });
	});

	it('updateSingleObject passes null through by default', async () => {
		transportMock.getProperties.mockResolvedValue(ok(personProperties) as never);
		transportMock.updateLimeobject.mockResolvedValue(ok({ _id: '5' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'updateSingleObject',
			limetype: 'person',
			id: '5',
			inputType: 'json',
			jsonData: '{"name":null}',
		});

		await node.execute.call(ctx);

		expect(transportMock.updateLimeobject).toHaveBeenCalledWith(ctx, 'person', '5', { name: null });
	});

	it('updateSingleObject sends empty strings for null text values when enabled', async () => {
		transportMock.getProperties.mockResolvedValue(ok(personProperties) as never);
		transportMock.updateLimeobject.mockResolvedValue(ok({ _id: '5' }) as never);
		const ctx = makeNodeExecuteContext({
			resource: 'data',
			operation: 'updateSingleObject',
			limetype: 'person',
			id: '5',
			inputType: 'json',
			jsonData: '{"name":null,"age":null}',
			acceptNullForTexts: true,
		});

		await node.execute.call(ctx);

		expect(transportMock.updateLimeobject).toHaveBeenCalledWith(ctx, 'person', '5', {
			name: '',
			age: null,
		});
	});
});
