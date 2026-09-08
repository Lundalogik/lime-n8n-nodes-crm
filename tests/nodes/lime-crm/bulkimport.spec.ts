import { uploadBulkImportData } from '../../../nodes';
import { IExecuteFunctions } from 'n8n-workflow';

function makeContext(): {
    context: IExecuteFunctions;
    requestMock: jest.Mock;
} {
    const requestMock = jest.fn().mockResolvedValue({});
    const context = {
        helpers: {
            httpRequestWithAuthentication: {
                call: requestMock,
            },
        },
        getCredentials: jest
            .fn()
            .mockResolvedValue({ url: 'https://lime.example.com' }),
        getNode: jest.fn().mockReturnValue({
            id: '1',
            name: 'LimeCRM',
            type: 'lime-crm',
        }),
        getWorkflow: jest.fn().mockReturnValue({ id: 'wf', name: 'Workflow' }),
        getInstanceId: jest.fn().mockReturnValue('instance-id'),
        getExecutionId: jest.fn().mockReturnValue('exec-id'),
        getMode: jest.fn().mockReturnValue('manual'),
    } as unknown as IExecuteFunctions;
    return { context, requestMock };
}

describe('uploadBulkImportData', () => {
    const data = [{ values: { name: 'Lime' } }];

    it('sends a multipart body with a matching boundary header', async () => {
        const { context, requestMock } = makeContext();

        await uploadBulkImportData(context, 'job-1', data);

        const requestOptions = requestMock.mock.calls[0][2];
        expect(Buffer.isBuffer(requestOptions.body)).toBe(true);

        const contentType = requestOptions.headers['content-type'];
        expect(contentType).toMatch(/^multipart\/form-data; boundary=/);

        const boundary = contentType.split('boundary=')[1];
        const body = requestOptions.body.toString('utf8');
        expect(body.startsWith(`--${boundary}\r\n`)).toBe(true);
        expect(body.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true);
    });

    it('includes the JSON payload as a file part named "file"', async () => {
        const { context, requestMock } = makeContext();

        await uploadBulkImportData(context, 'job-1', data);

        const body = requestMock.mock.calls[0][2].body.toString('utf8');
        expect(body).toContain(
            'Content-Disposition: form-data; name="file"; filename="import-data.json"'
        );
        expect(body).toContain('Content-Type: application/json');
        expect(body).toContain(JSON.stringify(data));
    });
});
