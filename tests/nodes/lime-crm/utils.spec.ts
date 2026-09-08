jest.mock('../../../nodes/lime-crm/transport', () => ({
	createFile: jest.fn().mockResolvedValue({
		success: true,
		data: { id: 1 },
	}),
	getFileMetadata: jest.fn().mockResolvedValue({
		success: true,
		data: {
			id: '123',
			name: 'file.txt',
		},
	}),
	getFileContent: jest.fn().mockResolvedValue({
		success: true,
		data: 'some binary data',
	}),
	getTasks: jest.fn(),
}));

import {
	createFile,
	getFileContent,
	getFileMetadata,
	getFilenameFromHeader,
	getFilePropertiesNames,
	getWebhook,
	processFileResponse,
	setFilename,
	setFileProperties,
	WebhookFunctions,
} from '../../../nodes';

describe('files', () => {
	describe('setFilename', () => {
		it('returns responseFileName if fileName is missing', () => {
			expect(setFilename({ fileExtension: 'jpg' } as any, 'default.jpg')).toBe('default.jpg');
		});
		it('returns existing fileName if present', () => {
			expect(setFilename({ fileName: 'aspen.jpg' } as any, 'default.jpg')).toBe('aspen.jpg');
		});
	});

	describe('getFilenameFromHeader', () => {
		it('returns null if header is missing', () => {
			expect(getFilenameFromHeader({})).toBeNull();
		});

		it('parses standard filename', () => {
			expect(
				getFilenameFromHeader({
					'content-disposition': 'attachment; filename="test.txt"',
				}),
			).toBe('test.txt');
		});

		it('parses RFC 5987 filename*', () => {
			expect(
				getFilenameFromHeader({
					'content-disposition': "attachment; filename*=UTF-8''test%20file.txt",
				}),
			).toBe('test file.txt');
		});
	});

	describe('getFilePropertiesNames', () => {
		const limetypes = [
			{
				name: 'company',
				type: 'belongsto',
				localname: 'company',
				required: false,
			},
			{
				name: 'name',
				type: 'string',
				localname: 'name',
				required: false,
			},
			{
				name: 'document',
				type: 'file',
				localname: 'document',
				required: false,
			},
			{
				name: 'photo',
				type: 'file',
				localname: 'photo',
				required: false,
			},
		];
		it('returns all file property names', async () => {
			const result = getFilePropertiesNames(limetypes);
			expect(result.has('document')).toBe(true);
			expect(result.has('photo')).toBe(true);
			expect(result.has('name')).toBe(false);
			expect(result.has('company')).toBe(false);
		});
		it('returns allowed file property names', async () => {
			const result = getFilePropertiesNames(limetypes, new Set(['document']));
			expect(result.has('document')).toBe(true);
			expect(result.has('photo')).toBe(false);
			expect(result.has('name')).toBe(false);
			expect(result.has('company')).toBe(false);
		});
	});

	describe('setFileProperties', () => {
		const mockContext: any = {
			helpers: {
				assertBinaryData: jest.fn(),
			},
		};
		const mockBinaryData = { data: 'some binary data' };

		beforeEach(() => {
			(createFile as jest.Mock).mockClear();
			mockContext.helpers.assertBinaryData.mockClear();
		});

		it('sets file properties successfully', async () => {
			mockContext.helpers.assertBinaryData.mockReturnValue(mockBinaryData);

			const definedProperties = { document: 'some binary data' };
			const result = await setFileProperties(
				mockContext,
				0,
				new Set(['document']),
				definedProperties,
			);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.document).toBe(1);
			}
		});

		it('sets file ID if assertBinaryData throws an error', async () => {
			mockContext.helpers.assertBinaryData.mockImplementation(() => {
				throw new Error('Invalid binary data');
			});
			const definedProperties = { document: 2 };
			const result = await setFileProperties(
				mockContext,
				0,
				new Set(['document']),
				definedProperties,
			);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.document).toBe(2);
			}
		});
	});

	describe('processFileResponse', () => {
		const mockNodeContext = {};

		beforeEach(() => {
			(getFileMetadata as jest.Mock).mockClear();
			(getFileContent as jest.Mock).mockClear();
		});

		it('returns file metadata without file content', async () => {
			const data = { document: 1 };
			const result = await processFileResponse<{ document: number }>(
				mockNodeContext as any,
				new Set(['document']),
				data,
			);
			expect(result.json.success).toBe(true);
			if (result.json.success) {
				expect(result.json.data.document).toEqual({
					id: '123',
					name: 'file.txt',
				});
				expect(result.binary).toEqual({});
			}
		});

		it('returns file metadata with file content', async () => {
			const data = { document: 1 };
			const result = await processFileResponse<{ document: number }>(
				mockNodeContext as any,
				new Set(['document']),
				data,
				true,
			);
			if (result.json.success) {
				expect(result.json.data.document).toEqual({
					id: '123',
					name: 'file.txt',
				});
				expect(result.binary?.document).toEqual('some binary data');
			}
		});
	});
});

describe('webhook', () => {
	describe('getWebhhok', () => {
		let mockHookData: jest.Mocked<WebhookFunctions>;

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(new Date('2025-11-12T12:00:00Z'));
			mockHookData = {
				getNode: jest.fn().mockReturnValue({ id: '1', name: 'MyNode' }),
				getWorkflow: jest.fn().mockReturnValue({ id: '2', name: 'MyWorkflow' }),
				getWorkflowStaticData: jest.fn().mockReturnValue({ key: 'value' }),
				getNodeWebhookUrl: jest.fn().mockReturnValue('https://example.com/hook'),
				getNodeParameter: jest.fn().mockReturnValue({
					event: [{ limetype: 'company', eventType: 'new' }],
				}),
			} as unknown as jest.Mocked<WebhookFunctions>;
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('constructs a full webhook object correctly', () => {
			const result = getWebhook(mockHookData);

			expect(result).toEqual({
				data: { key: 'value' },
				events: ['company.new'],
				url: 'https://example.com/hook',
				context: {
					nodeId: '1',
					nodeName: 'MyNode',
					workflowId: '2',
					workflowName: 'MyWorkflow',
				},
				name: 'company-new-1762948800000',
			});
		});
	});
});
