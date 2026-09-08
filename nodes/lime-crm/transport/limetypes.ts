import { IAllExecuteFunctions } from 'n8n-workflow';
import { callLimeApi, removeKeys } from './commons';
import { Limetype, LimetypeProperty } from '../models';
import { APIResponse } from '../../response';

/**
 * Endpoint path for Lime CRM Limetype API.
 *
 * @internal
 * @group Transport
 */
const LIMETYPE_URL = '/api/v1/limetype/';

/**
 * Lime CRM Limetype API response structure.
 *
 * @property name - The internal name of the property
 * @property _links - Optional API link metadata
 * @property _embedded - Optional embedded resources
 *
 * @public
 * @group Transport
 */
export interface LimetypePropertyApiResponse {
    name: string;
    _links?: object;
    _embedded?: object;
}

/**
 * Representation of a single Limetype object returned by the Lime CRM API.
 *
 * @property name - The internal name of the Limetype
 * @property localname - Optional local name for singular and plural forms
 * @property _embedded - Contains the Limetype's properties
 * @property _links - API link metadata.
 *
 * @public
 * @group Transport
 */
export interface LimetypeCrmApiResponse {
    name: string;
    localname?: {
        singular?: string;
        plural?: string;
    };
    _embedded: {
        properties: LimetypePropertyApiResponse[];
    };
    _links: object;
}

/**
 * Response structure for the `/limetype/` endpoint.
 *
 * @property _embedded - The embedded resources
 * @property _embedded.limetypes - The list of Limetype definitions
 * @property _embedded._links - API link metadata
 *
 * @public
 * @group Transport
 */
export interface LimetypesCrmApiResponse {
    _embedded: {
        limetypes: LimetypeCrmApiResponse[];
        _links: object;
    };
}

/**
 * Response structure for the Limetype properties API.
 *
 * @property _embedded - The embedded resources
 * @property _embedded.properties - The list of Limetype properties
 *
 * @public
 * @group Transport
 */
export interface LimetypePropertiesApiResponse {
    _embedded: {
        properties: LimetypeCrmApiResponse[];
    };
}

/**
 * Transform a Lime CRM API Limetype response into an internal {@link Limetype} model.
 *
 * Removes `_links` and `_embedded` metadata while preserving property data.
 *
 * @param limetype - The raw Limetype API response.
 * @returns A deserialized {@link Limetype} object.
 *
 * @internal
 * @group Transport
 */
function deserializeLimetype(limetype: LimetypeCrmApiResponse): Limetype {
    return {
        ...removeKeys(limetype, ['_links', '_embedded']),
        properties: limetype._embedded.properties.map((property) =>
            removeKeys(property, ['_links'])
        ),
    } as Limetype;
}

type RelatedTypeLinks = {
    related_type?: {
        name: string;
    };
};

function getRelatedLimetypeName(property: {
    _links?: unknown;
}): string | undefined {
    const links = property._links as RelatedTypeLinks | undefined;
    return links?.related_type?.name;
}

function deserializeLimetypeProperty(
    property: LimetypeCrmApiResponse
): LimetypeProperty {
    const relatedLimetype = getRelatedLimetypeName(property);

    return {
        ...removeKeys(property, ['_links', '_embedded']),
        ...(relatedLimetype ? { relatedLimetype } : {}),
    } as LimetypeProperty;
}

/**
 * Fetch all available Limetypes from the Lime CRM API, including their properties.
 *
 * @param nodeContext - The n8n execution context
 * @returns A list of {@link Limetype} objects
 *
 * @public
 * @group Transport
 */
export async function getLimetypesFromApi(
    nodeContext: IAllExecuteFunctions
): Promise<APIResponse<Limetype[]>> {
    const response = await callLimeApi<LimetypesCrmApiResponse>(nodeContext, {
        method: 'GET',
        url: LIMETYPE_URL,
        requestOptions: {
            qs: {
                _embed: 'limetypes.properties',
            },
        },
    });
    if (response.success) {
        return {
            success: true,
            data:
                response.data._embedded?.limetypes.map(deserializeLimetype) ||
                [],
        };
    } else {
        return response;
    }
}

/**
 * Fetch a specific Limetype definition from the Lime CRM API.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The internal name of the Limetype to fetch
 * @returns A {@link Limetype} object
 *
 * @public
 * @group Transport
 */
export async function getLimetype(
    nodeContext: IAllExecuteFunctions,
    limetype: string
): Promise<APIResponse<Limetype>> {
    const url = `${LIMETYPE_URL}${limetype}/`;
    const response = await callLimeApi<LimetypeCrmApiResponse>(nodeContext, {
        method: 'GET',
        url: url,
        requestOptions: {
            qs: {
                _embed: 'properties',
            },
        },
    });
    if (response.success) {
        return {
            success: true,
            data: deserializeLimetype(response.data),
        };
    } else {
        return response;
    }
}

/**
 * Fetch the property definitions of a specific Limetype.
 *
 * @param nodeContext - The n8n execution context
 * @param limetype - The internal name of the Limetype to fetch properties for
 * @returns An array of {@link LimetypeProperty} objects.
 *
 * @public
 * @group Transport
 */
export async function getProperties(
    nodeContext: IAllExecuteFunctions,
    limetype: string
): Promise<APIResponse<LimetypeProperty[]>> {
    const url = `${LIMETYPE_URL}${limetype}/`;
    const response = await callLimeApi<LimetypePropertiesApiResponse>(
        nodeContext,
        {
            method: 'GET',
            url: url,
            requestOptions: {
                qs: {
                    _embed: 'properties',
                },
            },
            errorMetadata: {
                limetype: limetype,
            },
        }
    );
    if (response.success) {
        const properties = response.data._embedded?.properties ?? [];
        return {
            success: true,
            data: properties.map(deserializeLimetypeProperty),
        };
    } else {
        return response;
    }
}
