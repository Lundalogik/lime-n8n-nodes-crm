// We mock only callLimeApi — everything above it runs for real.

import { NodeApiError } from 'n8n-workflow';
import * as commons from '../../../../nodes/LimeCrm/transport/commons';
import {
	createBulkImportJob,
	getBulkImportJobStatus,
	uploadBulkImportData,
	waitForBulkImportJob,
} from '../../../../nodes/LimeCrm/transport/bulkimport';
import { makeNodeExecuteContext } from '../helpers';

const callLimeApiMock = jest.spyOn(commons, 'callLimeApi') as unknown as jest.Mock;

const ok = <T>(data: T) => ({ success: true, data });
const errorEnvelope = {
	success: false,
	data: { error: { message: 'boom' } },
};

const ctx = makeNodeExecuteContext({});

beforeEach(() => {
	callLimeApiMock.mockReset();
});

afterEach(() => {
	jest.useRealTimers();
});

describe('createBulkImportJob', () => {
	const payload = {
		mode: 'create' as const,
		limetype: 'person',
		properties: ['name'],
	};

	it('posts the job payload and returns the created job', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 'job1', status: 'ready' }));

		const job = await createBulkImportJob(ctx, payload);

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'POST',
			url: '/limepkg-mbeku-bulk-import/bulk-imports/',
			requestOptions: { body: payload },
		});
		expect(job).toEqual({ id: 'job1', status: 'ready' });
	});

	it('throws a NodeApiError when the server rejects the job', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		await expect(createBulkImportJob(ctx, payload)).rejects.toThrow(NodeApiError);
		await expect(createBulkImportJob(ctx, payload)).rejects.toThrow(
			'The bulk import job was rejected by the server.',
		);
	});
});

describe('uploadBulkImportData', () => {
	it('uploads the data as a JSON file via multipart form data', async () => {
		callLimeApiMock.mockResolvedValue(ok({}));

		await uploadBulkImportData(ctx, 'job1', [{ name: 'obj0' }]);

		const options = callLimeApiMock.mock.calls[0][1];
		expect(options.method).toBe('POST');
		expect(options.url).toBe('/limepkg-mbeku-bulk-import/bulk-imports/job1');
		expect(options.json).toBe(false);

		// The body is hand-built multipart form data (no formData request
		// option) and its boundary must match the content-type header.
		const contentType = options.requestOptions.headers['content-type'];
		const boundary = contentType.match(/^multipart\/form-data; boundary=(.+)$/)?.[1];
		expect(boundary).toBeDefined();

		const body = options.requestOptions.body.toString('utf8');
		expect(body).toBe(
			`--${boundary}\r\n` +
				'Content-Disposition: form-data; name="file"; filename="import-data.json"\r\n' +
				'Content-Type: application/json\r\n\r\n' +
				'[{"name":"obj0"}]' +
				`\r\n--${boundary}--\r\n`,
		);
	});

	it('generates a unique boundary per upload', async () => {
		callLimeApiMock.mockResolvedValue(ok({}));

		await uploadBulkImportData(ctx, 'job1', []);
		await uploadBulkImportData(ctx, 'job2', []);

		const boundaryOf = (call: number) =>
			callLimeApiMock.mock.calls[call][1].requestOptions.headers['content-type'];
		expect(boundaryOf(0)).not.toBe(boundaryOf(1));
	});

	it('throws a NodeApiError when the upload is rejected', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		await expect(uploadBulkImportData(ctx, 'job1', [])).rejects.toThrow(
			'The bulk import data upload was rejected by the server.',
		);
	});
});

describe('getBulkImportJobStatus', () => {
	it('fetches the job status', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 'job1', status: 'succeeded' }));

		const job = await getBulkImportJobStatus(ctx, 'job1');

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/limepkg-mbeku-bulk-import/bulk-imports/job1',
		});
		expect(job).toEqual({ id: 'job1', status: 'succeeded' });
	});

	it('throws a NodeApiError when the status cannot be retrieved', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		await expect(getBulkImportJobStatus(ctx, 'job1')).rejects.toThrow(
			'The bulk import job status could not be retrieved.',
		);
	});
});

describe('waitForBulkImportJob', () => {
	it('polls until the job reaches a terminal status', async () => {
		jest.useFakeTimers();
		callLimeApiMock
			.mockResolvedValueOnce(ok({ id: 'job1', status: 'ready' }))
			.mockResolvedValueOnce(ok({ id: 'job1', status: 'running' }))
			.mockResolvedValueOnce(ok({ id: 'job1', status: 'succeeded' }));

		const promise = waitForBulkImportJob(ctx, 'job1', 2500);
		await jest.advanceTimersByTimeAsync(2500);
		await jest.advanceTimersByTimeAsync(2500);
		await jest.advanceTimersByTimeAsync(2500);

		await expect(promise).resolves.toEqual({
			id: 'job1',
			status: 'succeeded',
		});
		expect(callLimeApiMock).toHaveBeenCalledTimes(3);
	});

	it('treats failed as a terminal status', async () => {
		jest.useFakeTimers();
		callLimeApiMock.mockResolvedValue(ok({ id: 'job1', status: 'failed' }));

		const promise = waitForBulkImportJob(ctx, 'job1', 2500);
		await jest.advanceTimersByTimeAsync(2500);

		await expect(promise).resolves.toEqual({
			id: 'job1',
			status: 'failed',
		});
		expect(callLimeApiMock).toHaveBeenCalledTimes(1);
	});

	it('waits the poll interval before each status check', async () => {
		jest.useFakeTimers();
		callLimeApiMock.mockResolvedValue(ok({ id: 'job1', status: 'succeeded' }));

		const promise = waitForBulkImportJob(ctx, 'job1', 1000);
		await jest.advanceTimersByTimeAsync(999);
		expect(callLimeApiMock).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);
		await promise;
		expect(callLimeApiMock).toHaveBeenCalledTimes(1);
	});
});
