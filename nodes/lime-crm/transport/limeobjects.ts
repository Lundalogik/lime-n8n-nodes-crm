import { callLimeApi, prepareResponseWithoutKeys } from './commons';
import { IAllExecuteFunctions } from 'n8n-workflow';
import { Limeobject } from '../models';
import { APIResponse } from '../../response';
/**
 * Endpoint path for Lime CRM Limeobject API.
 *
 * @internal
 * @group Transport
 */
const LIMEOBJECT_URL = '/api/v1/limeobject/';

/**
 * Single Limeobject representation returned by the CRM API.
 *
 * @property id_ - The unique ID of the Limeobject
 * @property _links - Links metadata returned by the API (not used in processing)
 * @public
 * @group Transport
 */
export interface LimeobjectCrmApiResponse {
    id_: number;
    _links: object;
}

/**
 * Representation of the response from the CRM API when fetching multiple Limeobjects.
 *
 * @property _embedded - The embedded resources
 * @property _embedded.limeobjects - An array of Limeobjects returned by the API. {@link LimeobjectCrmApiResponse}
 * @public
 * @group Transport
 */
export interface FetchManyLimeobjectsApiResponse {
    _embedded: {
        limeobjects: LimeobjectCrmApiResponse[];
    };
}

/**
 * Create a new Limeobject for the specified Limetype.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The Limetype of the object to create
 * @param data - The data object to send to the API
 * @returns The created Limeobject
 * @public
 * @group Transport
 */
export async function createLimeobject(
    nodeContext: IAllExecuteFunctions,
    limetype: string,
    data: object
): Promise<APIResponse<Limeobject>> {
    const url = `${LIMEOBJECT_URL}${limetype}/`;
    const response = await callLimeApi<LimeobjectCrmApiResponse>(nodeContext, {
        method: 'POST',
        url: url,
        requestOptions: {
            body: data,
        },
        errorMetadata: {
            limetype: limetype,
        },
    });
    if (response.success) {
        return prepareResponseWithoutKeys(response, ['_links']);
    } else {
        return response;
    }
}

/**
 * Delete a Limeobject.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The Limetype of the object to delete
 * @param id - The ID of the Limeobject
 * @returns empty response
 *
 * @public
 * @group Transport
 */
export async function deleteLimeobject(
    nodeContext: IAllExecuteFunctions,
    limetype: string,
    id: string
): Promise<APIResponse<Record<string, never>>> {
    const url = `${LIMEOBJECT_URL}${limetype}/${id}/`;
    return await callLimeApi<Record<string, never>>(nodeContext, {
        method: 'DELETE',
        url: url,
        errorMetadata: {
            limetype: limetype,
            id: id,
        },
    });
}

/**
 * Retrieve a Limeobject.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The Limetype of the object to retrieve
 * @param id - The ID of the Limeobject
 * @returns The Limeobject.
 *
 * @public
 * @group Transport
 */
export async function getLimeobject(
    nodeContext: IAllExecuteFunctions,
    limetype: string,
    id: string
): Promise<APIResponse<Limeobject>> {
    const url = `${LIMEOBJECT_URL}${limetype}/${id}/`;
    const response = await callLimeApi<LimeobjectCrmApiResponse>(nodeContext, {
        method: 'GET',
        url: url,
        errorMetadata: {
            limetype: limetype,
            id: id,
        },
    });
    if (response.success) {
        return prepareResponseWithoutKeys(response, ['_links']);
    } else {
        return response;
    }
}

/**
 * Update a Limeobject.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The Limetype of the object to update
 * @param id - The ID of the Limeobject
 * @param data - The updated data to send
 * @returns The updated Limeobject.
 *
 * @public
 * @group Transport
 */
export async function updateLimeobject(
    nodeContext: IAllExecuteFunctions,
    limetype: string,
    id: string,
    data: object
): Promise<APIResponse<Limeobject>> {
    const url = `${LIMEOBJECT_URL}${limetype}/${id}/`;
    const response = await callLimeApi<LimeobjectCrmApiResponse>(nodeContext, {
        method: 'PUT',
        url: url,
        requestOptions: {
            body: data,
        },
        errorMetadata: {
            limetype: limetype,
            id: id,
        },
    });
    if (response.success) {
        return prepareResponseWithoutKeys(response, ['_links']);
    } else {
        return response;
    }
}
