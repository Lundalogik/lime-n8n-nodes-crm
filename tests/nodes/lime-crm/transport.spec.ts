import { callLimeApi } from '../../../nodes';
import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';

function makeContext(
    throwError: unknown,
    continueOnFail = true
): IExecuteFunctions {
    return {
        helpers: {
            httpRequestWithAuthentication: {
                call: jest.fn().mockRejectedValue(throwError),
            },
        },
        getCredentials: jest
            .fn()
            .mockResolvedValue({ url: 'https://lime.example.com' }),
        getNode: jest.fn().mockReturnValue({
            id: '1',
            name: 'LimeCRM',
            type: 'lime-crm',
            ...(continueOnFail && { onError: 'continueRegularOutput' }),
        }),
        getWorkflow: jest.fn().mockReturnValue({ id: 'wf', name: 'Workflow' }),
        getInstanceId: jest.fn().mockReturnValue('instance-id'),
        getExecutionId: jest.fn().mockReturnValue('exec-id'),
        getMode: jest.fn().mockReturnValue('manual'),
    } as unknown as IExecuteFunctions;
}

describe('callLimeApi error handling', () => {
    const baseOptions = { method: 'GET' as const, url: '/api/v1/limetypes/' };

    it('combines error message and description into the error message', async () => {
        const error = Object.assign(new Error('404 Not Found'), {
            description: 'The property "active" does not exist.',
            httpCode: 404,
        });

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.message).toBe(
                '404 Not Found. The property "active" does not exist.'
            );
        }
    });

    it('uses only the error message when no description is present', async () => {
        const error = new Error('Credentials could not be loaded');

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.message).toBe(
                'Credentials could not be loaded'
            );
            expect(result.data.error.message).not.toContain('undefined');
        }
    });

    it('includes the status from httpCode in the error context', async () => {
        const error = Object.assign(new Error('404 Not Found'), {
            description: 'Object not found.',
            httpCode: 404,
        });

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.status).toBe(404);
        }
    });

    it('leaves status undefined when httpCode is absent', async () => {
        const error = Object.assign(new Error('503 Service Unavailable'), {
            description: 'Service temporarily unavailable.',
        });

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.status).toBeUndefined();
        }
    });

    it('includes the API response body from error.context.data', async () => {
        const apiBody = { detail: 'Validation failed', code: 'invalid_field' };
        const error = Object.assign(new Error('400 Bad Request'), {
            description: 'Invalid field value.',
            httpCode: 400,
            context: { data: apiBody },
        });

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.error).toEqual(apiBody);
        }
    });

    it('omits the error body when error.context.data is absent', async () => {
        const error = Object.assign(new Error('503 Service Unavailable'), {
            description: 'Service temporarily unavailable.',
            httpCode: 503,
        });

        const result = await callLimeApi(makeContext(error), baseOptions);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error).not.toHaveProperty('error');
        }
    });

    it('passes errorMetadata through to the error context metadata', async () => {
        const error = Object.assign(new Error('400 Bad Request'), {
            description: 'Invalid field value.',
            httpCode: 400,
        });

        const result = await callLimeApi(makeContext(error), {
            ...baseOptions,
            errorMetadata: { limetype: 'deal', operation: 'create' },
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.data.error.metadata).toEqual({
                limetype: 'deal',
                operation: 'create',
            });
        }
    });

    describe('when continueOnFail is false', () => {
        it('throws a NodeApiError with the error context as errorResponse', async () => {
            const error = Object.assign(new Error('404 Not Found'), {
                description: 'Object not found.',
                httpCode: 404,
            });

            await expect(
                callLimeApi(makeContext(error, false), baseOptions)
            ).rejects.toBeInstanceOf(NodeApiError);
        });

        it('includes message and status in the thrown error response', async () => {
            const error = Object.assign(new Error('400 Bad Request'), {
                description: 'Invalid field value.',
                httpCode: 400,
            });

            await expect(
                callLimeApi(makeContext(error, false), baseOptions)
            ).rejects.toMatchObject({
                errorResponse: {
                    message: '400 Bad Request. Invalid field value.',
                    status: 400,
                },
            });
        });
    });
});

// Context whose HTTP helper resolves; records the request it was given.
function makeSuccessContext(response: unknown = {}): {
    ctx: IExecuteFunctions;
    lastRequest: () => Record<string, unknown>;
} {
    const httpMock = jest.fn().mockResolvedValue(response);
    const ctx = {
        helpers: { httpRequestWithAuthentication: { call: httpMock } },
        getCredentials: jest
            .fn()
            .mockResolvedValue({ url: 'https://lime.example.com' }),
        getNode: jest
            .fn()
            .mockReturnValue({ id: '1', name: 'LimeCRM', type: 'lime-crm' }),
        getWorkflow: jest.fn().mockReturnValue({ id: 'wf', name: 'Workflow' }),
        getInstanceId: jest.fn().mockReturnValue('instance-id'),
        getExecutionId: jest.fn().mockReturnValue('exec-id'),
        getMode: jest.fn().mockReturnValue('manual'),
    } as unknown as IExecuteFunctions;
    // call(thisArg, credentialKey, requestOptions) — the request is arg 2.
    return { ctx, lastRequest: () => httpMock.mock.calls[0][2] };
}

describe('callLimeApi success path', () => {
    it('wraps the HTTP response in a success envelope', async () => {
        const { ctx } = makeSuccessContext({ hello: 'lime' });

        const result = await callLimeApi(ctx, {
            method: 'GET',
            url: '/api/v1/limetype/',
        });

        expect(result).toEqual({ success: true, data: { hello: 'lime' } });
    });

    it('assembles the request from options and the credential base URL', async () => {
        const { ctx, lastRequest } = makeSuccessContext();

        await callLimeApi(ctx, {
            method: 'POST',
            url: '/api/v1/limeobject/person/',
            requestOptions: { body: { name: 'Jane' }, qs: { _embed: 'x' } },
        });

        expect(lastRequest()).toMatchObject({
            method: 'POST',
            url: '/api/v1/limeobject/person/',
            baseURL: 'https://lime.example.com',
            body: { name: 'Jane' },
            qs: { _embed: 'x' },
            json: true,
        });
    });

    it('keeps json: false instead of defaulting it to true', async () => {
        const { ctx, lastRequest } = makeSuccessContext();

        await callLimeApi(ctx, {
            method: 'GET',
            url: '/api/v1/file/1/contents/',
            json: false,
        });

        expect(lastRequest().json).toBe(false);
    });

    it('sends the Lime tracking headers', async () => {
        const { ctx, lastRequest } = makeSuccessContext();

        await callLimeApi(ctx, { method: 'GET', url: '/api/v1/limetype/' });

        expect(lastRequest().headers).toMatchObject({
            'X-N8N-Workflow-Id': 'wf',
            'X-N8N-Node-Name': 'LimeCRM',
            'X-N8N-Execution-Id': 'exec-id',
        });
    });

    it('lets caller headers override the built Lime headers', async () => {
        const { ctx, lastRequest } = makeSuccessContext();

        await callLimeApi(ctx, {
            method: 'GET',
            url: '/api/v1/limetype/',
            requestOptions: {
                headers: { 'X-N8N-Node-Name': 'custom', 'X-Extra': 'yes' },
            },
        });

        expect(lastRequest().headers).toMatchObject({
            'X-N8N-Node-Name': 'custom',
            'X-Extra': 'yes',
            'X-N8N-Workflow-Id': 'wf',
        });
    });
});
