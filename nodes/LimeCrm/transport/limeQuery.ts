import { IAllExecuteFunctions } from 'n8n-workflow';
import { callLimeApi } from './commons';
import { APIResponsePrimitiveValue } from '../models';
import { APIResponse } from '../../response';
/**
 * Endpoint path for Lime CRM Lime Query API.
 *
 * @internal
 * @group Transport
 */
const LIME_QUERY_URL = '/api/v1/query/';

/**
 * Structure of included properties returned by a query.
 *
 * The properties can themselves contain nested objects, primitive values, or nulls.
 *
 * @public
 * @group Transport
 */
export interface IncludedProperties {
	[key: string]: IncludedProperties | APIResponsePrimitiveValue;
}

/**
 * The structure of a Lime CRM query API response.
 *
 * @property objects - An array of returned Limeobjects with their properties represented by a {@link IncludedProperties}
 *
 * @public
 * @group Transport
 */
export interface QueryResponse {
	objects: IncludedProperties[];
}

/**
 * Execute a Lime CRM query through the API.
 *
 * @param nodeContext - The n8n execution context
 * @param q - The query string to execute
 * @returns Query results
 *
 * @public
 * @group Transport
 */
export async function queryLimeobjects(
	nodeContext: IAllExecuteFunctions,
	q: string,
): Promise<APIResponse<QueryResponse>> {
	const queryParameters = {
		q: q,
	};

	return await callLimeApi(nodeContext, {
		method: 'GET',
		url: LIME_QUERY_URL,
		requestOptions: {
			qs: queryParameters,
		},
	});
}
