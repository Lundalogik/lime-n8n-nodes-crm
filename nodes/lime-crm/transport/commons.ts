import { LIME_CRM_API_CREDENTIAL_KEY } from '../models';
import { IAllExecuteFunctions, JsonObject } from 'n8n-workflow';
import { WorkflowErrorContext, handleWorkflowError } from '../utils';
import { APIResponse, SuccessResponse } from '../../response';
import { buildLimeHeaders } from '../../limeHeaders';

/**
 * HTTP methods supported by the Lime CRM API.
 *
 * @group Transport
 * @public
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Return a copy of the given object with specified keys removed.
 *
 * @param data - The source object
 * @param keys - An array of keys to remove from the object
 *
 * @returns A new object with the specified keys omitted
 *
 * @public
 * @group Transport
 */
export function removeKeys<T extends object, K extends keyof T>(
    data: T,
    keys: K[]
): Omit<T, K> {
    const { ...obj } = data;
    for (const key of keys) {
        delete obj[key];
    }
    return obj;
}

export function prepareResponseWithoutKeys<T extends object, K extends keyof T>(
    response: SuccessResponse<T>,
    keys: K[]
): SuccessResponse<Omit<T, K>> {
    return {
        success: true,
        data: removeKeys(response.data, keys),
    };
}

/**
 * Retrieve the base URL for the Lime CRM API from stored credentials.
 *
 * @param context - The n8n execution context
 *
 * @returns The Lime CRM API base URL as a string
 *
 * @internal
 * @group Transport
 */
async function getLimeUrl(context: IAllExecuteFunctions): Promise<string> {
    const credentials = await context.getCredentials(
        LIME_CRM_API_CREDENTIAL_KEY
    );
    return credentials.url as string;
}

/**
 * CallLimeAPI arguments wrapped in a single interface to enable keyword-style
 * arguments.
 *
 * @property method - The HTTP method to use (GET, POST, etc.)
 * @property url - The API endpoint URL (relative path)
 * @property requestOptions - Optional additional request options (headers, body, query, etc.)
 * @property json - Whether to parse the response as JSON.
 * @property errorMetadata - Additional information we want to pass to message in case of error
 *
 * @public
 * @group Transport
 */

interface LimeAPIArguments {
    method: HTTPMethod;
    url: string;
    requestOptions?: {
        headers?: Record<string, string>;
        [key: string]: unknown;
    };
    json?: boolean;
    errorMetadata?: JsonObject;
}

/**
 * Make an authenticated HTTP request to the Lime CRM API and returns a structured response.
 *
 * @typeParam T - The expected type of the API response data
 * @param nodeContext - The n8n execution context
 * @param options - {@link LimeAPIArguments} object
 *
 * @returns API data or response details
 *
 * @public
 * @group Transport
 */
export async function callLimeApi<T>(
    nodeContext: IAllExecuteFunctions,
    options: LimeAPIArguments
): Promise<APIResponse<T>> {
    try {
        const { headers: callerHeaders, ...restRequestOptions } =
            options.requestOptions ?? {};
        const response =
            await nodeContext.helpers.httpRequestWithAuthentication.call(
                nodeContext,
                LIME_CRM_API_CREDENTIAL_KEY,
                {
                    method: options.method,
                    url: options.url,
                    json: options.json ?? true,
                    baseURL: await getLimeUrl(nodeContext),
                    ...restRequestOptions,
                    headers: {
                        ...buildLimeHeaders(nodeContext),
                        ...callerHeaders,
                    },
                }
            );
        return {
            success: true,
            data: response,
        };
    } catch (error) {
        const apiBody = error.context?.data;
        const errorContext: WorkflowErrorContext = {
            message: error.description
                ? `${error.message}. ${error.description}`
                : error.message,
            status: error.httpCode ?? undefined,
            metadata: {
                ...options.errorMetadata,
            },
            ...(apiBody != null && { error: apiBody }),
        };
        return handleWorkflowError(nodeContext.getNode(), errorContext, true);
    }
}
