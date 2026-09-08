import { IBinaryData } from 'n8n-workflow';
import * as commons from '../../../../nodes/lime-crm/transport/commons';
import * as limeobjects from '../../../../nodes/lime-crm/transport/limeobjects';
import {
	createFile,
	getFileContent,
	getFileContentByLimetype,
	getFileMetadataByLimeobject,
} from '../../../../nodes/lime-crm/transport/files';
import { makeNodeExecuteContext } from '../helpers';

const callLimeApiMock = jest.spyOn(commons, 'callLimeApi') as unknown as jest.Mock;
const getLimeobjectMock = jest.spyOn(limeobjects, 'getLimeobject') as unknown as jest.Mock;

const ok = <T>(data: T) => ({ success: true, data });
const errorEnvelope = {
	success: false,
	data: { error: { message: 'boom' } },
};

const ctx = makeNodeExecuteContext({});

beforeEach(() => {
	callLimeApiMock.mockReset();
	getLimeobjectMock.mockReset();
});

describe('getFileMetadataByLimeobject', () => {
	it('reads the file id from the limeobject and fetches its metadata', async () => {
		getLimeobjectMock.mockResolvedValue(ok({ _id: 5, document: 0 }));
		callLimeApiMock.mockResolvedValue(
			ok({ id: 0, filename: 'cv.pdf', _links: { self: { href: '/x' } } }),
		);

		const response = await getFileMetadataByLimeobject(ctx, 'person', '5', 'document');

		expect(getLimeobjectMock).toHaveBeenCalledWith(ctx, 'person', '5');
		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/api/v1/file/0/',
		});
		expect(response).toEqual(ok({ id: 0, filename: 'cv.pdf' }));
	});

	it('returns an error envelope when the property holds no file', async () => {
		getLimeobjectMock.mockResolvedValue(ok({ _id: 5, document: null }));
		const continueCtx = makeNodeExecuteContext({}, { onError: 'continueRegularOutput' });

		const response = await getFileMetadataByLimeobject(continueCtx, 'person', '5', 'document');

		expect(response).toEqual({
			success: false,
			data: {
				error: {
					message: 'The specified Limeobject does not have an associated file',
				},
			},
		});
		expect(callLimeApiMock).not.toHaveBeenCalled();
	});

	it('passes a failed limeobject lookup through unchanged', async () => {
		getLimeobjectMock.mockResolvedValue(errorEnvelope);

		const response = await getFileMetadataByLimeobject(ctx, 'person', '5', 'document');

		expect(response).toBe(errorEnvelope);
	});
});

describe('getFileContent', () => {
	const fileBody = Buffer.from('file-bytes');

	function mockContentResponse(headers: Record<string, string>) {
		callLimeApiMock.mockResolvedValue(ok({ headers, body: fileBody }));
	}

	it('downloads the raw content and names it from the response header', async () => {
		mockContentResponse({
			'content-disposition': 'attachment; filename="report.pdf"',
		});

		const response = await getFileContent(ctx, 42);

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: '/api/v1/file/42/contents/',
			json: false,
			requestOptions: {
				encoding: 'stream',
				returnFullResponse: true,
			},
		});
		expect(response.success).toBe(true);
		const binary = response.data as IBinaryData;
		expect(binary.data).toBe(fileBody.toString('base64'));
		expect(binary.fileName).toBe('report.pdf');
	});

	it('falls back to a generated filename without a content-disposition header', async () => {
		mockContentResponse({});

		const response = await getFileContent(ctx, 42);

		expect((response.data as IBinaryData).fileName).toBe('file_42');
	});

	it('passes an error envelope through unchanged', async () => {
		callLimeApiMock.mockResolvedValue(errorEnvelope);

		const response = await getFileContent(ctx, 42);

		expect(response).toBe(errorEnvelope);
	});
});

describe('getFileContentByLimetype', () => {
	it('reads the file id from the limeobject and downloads its content', async () => {
		getLimeobjectMock.mockResolvedValue(ok({ _id: 5, document: 0 }));
		callLimeApiMock.mockResolvedValue(ok({ headers: {}, body: Buffer.from('x') }));

		const response = await getFileContentByLimetype(ctx, 'person', '5', 'document');

		expect(callLimeApiMock).toHaveBeenCalledWith(
			ctx,
			expect.objectContaining({ url: '/api/v1/file/0/contents/' }),
		);
		expect(response.success).toBe(true);
	});

	it('returns an error envelope when the property holds no file', async () => {
		getLimeobjectMock.mockResolvedValue(ok({ _id: 5 }));
		const continueCtx = makeNodeExecuteContext({}, { onError: 'continueRegularOutput' });

		const response = await getFileContentByLimetype(continueCtx, 'person', '5', 'document');

		expect(response).toEqual({
			success: false,
			data: {
				error: {
					message: 'The specified Limeobject does not have an associated file.',
				},
			},
		});
	});
});

describe('createFile', () => {
	const binary = {
		data: Buffer.from('file-bytes').toString('base64'),
		mimeType: 'application/pdf',
		fileName: 'årsrapport.pdf',
	} as IBinaryData;

	it('uploads the binary with an RFC 5987 encoded filename', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 9, filename: 'årsrapport.pdf', _links: {} }));

		const response = await createFile(ctx, binary, 'fallback.pdf');

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'POST',
			url: '/api/v1/file/',
			requestOptions: {
				body: Buffer.from('file-bytes'),
				headers: {
					'Content-Disposition': `;filename*="UTF-8''${encodeURIComponent('årsrapport.pdf')}"`,
					'Content-Type': 'application/pdf',
				},
			},
		});
		expect(response).toEqual(ok({ id: 9, filename: 'årsrapport.pdf' }));
	});

	it('uses the fallback filename when the binary has none', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 9 }));

		await createFile(ctx, { ...binary, fileName: undefined }, 'prop.pdf');

		const headers = callLimeApiMock.mock.calls[0][1].requestOptions.headers;
		expect(headers['Content-Disposition']).toBe(`;filename*="UTF-8''prop.pdf"`);
	});

	it('passes a failed upload response through unchanged', async () => {
		callLimeApiMock.mockResolvedValue({
			success: false,
			data: {
				error: {
					message: 'too large',
					status: 413,
					metadata: { limetype: 'person' },
				},
			},
		});

		const response = await createFile(ctx, binary, 'fallback.pdf');

		expect(response).toEqual({
			success: false,
			data: {
				error: {
					message: 'too large',
					status: 413,
					metadata: { limetype: 'person' },
				},
			},
		});
	});
});
