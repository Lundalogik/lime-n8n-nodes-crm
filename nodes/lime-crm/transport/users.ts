import { callLimeApi } from './commons';
import {
    IAllExecuteFunctions,
    LoggerProxy as Logger,
    NodeApiError,
} from 'n8n-workflow';
import {
    User,
    UserType,
    DEFAULT_API_OBJECT_LIMIT,
    NullOptionType,
    Limetype,
} from '../models';
import { getLimetypesFromApi } from './limetypes';
import { queryLimeobjects, QueryResponse } from './limeQuery';
import { getLimeobject } from './limeobjects';
import { APIResponse } from '../../response';
import { handleWorkflowError } from '../../errorHandling';
const USERS_URL = 'api/v1/admin/users/';

type UserQueryParameters = {
    active?: boolean;
    user_type?: UserType;
    _limit: number;
};

/**
 * Finds limetype that has a property of type 'user'.
 * There should only be one such limetype in the system.
 *
 * @param limetypes - Array of limetype objects to search through
 * @returns The first limetype with a 'user' property, or undefined if not found
 * @internal
 */
function findCoworkerLimetype(limetypes: Limetype[]): Limetype | undefined {
    for (const limetype of limetypes) {
        for (const property of limetype.properties) {
            if (property.type === 'user') {
                Logger.info('Found coworker limetype');
                return limetype;
            }
        }
    }
    Logger.warn('No coworker limetype found');
    return undefined;
}

/**
 * Retrieves the coworker limetype from the API.
 *
 * @param nodeContext - The n8n execution context
 * @returns The coworker limetype object
 * @throws NodeApiError if no coworker limetype is found
 * @internal
 */
async function findCoworker(
    nodeContext: IAllExecuteFunctions
): Promise<APIResponse<Limetype>> {
    const response = await getLimetypesFromApi(nodeContext);
    if (!response.success) {
        return response;
    }
    const coworker = findCoworkerLimetype(response.data);
    if (!coworker) {
        return handleWorkflowError(
            nodeContext.getNode(),
            {
                message: `No limetype with 'user' property found to get coworker`,
            },
            true
        );
    }
    return {
        success: true,
        data: coworker,
    };
}

/**
 * Fetches coworker data for a given user.
 *
 * @param nodeContext - The n8n execution context
 * @param coworker - The limetype definition for the coworker
 * @param userId - The ID of the user whose coworker data is to be fetched
 * @returns The coworker data response from the Lime Query API
 * @throws NodeApiError' property is found in the coworker limetype
 * @internal
 */
async function getCoworker(
    nodeContext: IAllExecuteFunctions,
    coworker: Limetype,
    userId: string | number
): Promise<APIResponse<QueryResponse>> {
    // 'hasmany' properties are not supported in the response format of Lime Query API
    const properties = Object.fromEntries(
        coworker.properties
            .filter((prop) => prop.type !== 'hasmany')
            .map((prop) => [prop.name, ''])
    );

    const userProperty = coworker.properties.find(
        (prop) => prop.type === 'user'
    );
    if (!userProperty) {
        throw new NodeApiError(nodeContext.getNode(), {
            message: `No property of type 'user' found in ${coworker.name} limetype`,
        });
    }

    const responseFormat = {
        object: properties,
    };
    const filter = {
        key: userProperty.name,
        op: '=',
        exp: userId,
    };
    const q = JSON.stringify({
        limetype: coworker.name,
        responseFormat: responseFormat,
        filter: filter,
    });

    return await queryLimeobjects(nodeContext, q);
}

/**
 * Fetch the Lime CRM users with given parameters.
 *
 * @param nodeContext - The n8n execution context
 * @param active - flag used to filtering by active or inactive users
 * @param userType - a type of a user defined in the {@link UserType} class
 * @param limit - max number of users returned by the API call, default is 50
 * @param withCoworker - whether to include coworker data linked to the user
 *
 * @returns List of {@link User} objects
 * @public
 * @group Transport
 */

export async function fetchManyUsers(
    nodeContext: IAllExecuteFunctions,
    active: boolean | NullOptionType = '',
    userType: UserType | NullOptionType = '',
    limit: number = DEFAULT_API_OBJECT_LIMIT,
    withCoworker: boolean = false
): Promise<APIResponse<User[]>> {
    const queryParams: UserQueryParameters = {
        _limit: limit,
    };
    if (active !== '') {
        queryParams.active = active;
    }
    if (userType !== '') {
        queryParams.user_type = userType;
    }

    const response = await callLimeApi<User[]>(nodeContext, {
        method: 'GET',
        url: USERS_URL,
        requestOptions: {
            qs: queryParams,
        },
    });

    if (!response.success || !withCoworker) return response;

    const coworkerLimetypeResponse = await findCoworker(nodeContext);
    if (!coworkerLimetypeResponse.success) return coworkerLimetypeResponse;

    const coworkerLimetype = coworkerLimetypeResponse.data;

    const usersWithCoworkers: User[] = [];
    for (const user of response.data) {
        const coworkerResponse = await getCoworker(
            nodeContext,
            coworkerLimetype,
            user.id
        );
        if (!coworkerResponse.success) return coworkerResponse;
        usersWithCoworkers.push({
            ...user,
            [coworkerLimetype.name]: coworkerResponse.data.objects[0] || null,
        });
    }

    return {
        success: true,
        data: usersWithCoworkers,
    };
}

/**
 * Fetch the single Lime CRM User by ID.
 *
 * @param nodeContext - The n8n execution context
 * @param id - Lime CRM user's ID
 * @param withCoworker - whether to include coworker data linked to the user
 *
 * @returns A {@link User} object
 * @public
 * @group Transport
 */

export async function fetchSingleUserById(
    nodeContext: IAllExecuteFunctions,
    id: string,
    withCoworker: boolean = false
): Promise<APIResponse<User>> {
    const url = `${USERS_URL}${id}`;
    const userResponse = await callLimeApi<User>(nodeContext, {
        method: 'GET',
        url: url,
        errorMetadata: {
            user_id: id,
        },
    });

    if (!userResponse.success || !withCoworker) return userResponse;
    const coworkerLimetypeResponse = await findCoworker(nodeContext);
    if (!coworkerLimetypeResponse.success) return coworkerLimetypeResponse;

    const coworkerResponse = await getCoworker(
        nodeContext,
        coworkerLimetypeResponse.data,
        id
    );
    if (!coworkerResponse.success) return coworkerResponse;

    return {
        success: true,
        data: {
            ...userResponse.data,
            [coworkerLimetypeResponse.data.name]:
                coworkerResponse.data.objects[0] || null,
        },
    };
}

/**
 * Fetch a single Lime CRM User by the related limeobject ID.
 *
 * This function retrieves a user based on the ID of a related limeobject.
 * It could be only one object related to the user in the system, most often it is the
 * 'coworker' limetype. The corresponding limetype is determined automatically.
 *
 * @param nodeContext - The n8n execution context
 * @param id - The ID of the coworker limeobject
 * @param withCoworker - Whether to include coworker data linked to the user (default: false)
 *
 * @returns A {@link User} object, optionally with coworker data
 * @public
 * @group Transport
 */
export async function fetchSingleUserByLimeobjectId(
    nodeContext: IAllExecuteFunctions,
    id: string,
    withCoworker: boolean = false
): Promise<APIResponse<User>> {
    const coworkerLimetypeResponse = await findCoworker(nodeContext);
    if (!coworkerLimetypeResponse.success) return coworkerLimetypeResponse;

    const coworkerLimetype = coworkerLimetypeResponse.data;

    const coworkerResponse = await getLimeobject(
        nodeContext,
        coworkerLimetype.name,
        id
    );
    if (!coworkerResponse.success) return coworkerResponse;

    const userProperty = coworkerLimetype.properties.find(
        (prop) => prop.type === 'user'
    );
    if (!userProperty) {
        return handleWorkflowError(
            nodeContext.getNode(),
            {
                message: `No property of type 'user' found in ${coworkerLimetype.name} limetype`,
            },
            true
        );
    }

    const url = `${USERS_URL}${coworkerResponse.data[userProperty.name]}`;
    const userResponse = await callLimeApi<User>(nodeContext, {
        method: 'GET',
        url: url,
        errorMetadata: {
            user_id: id,
        },
    });

    if (!userResponse.success || !withCoworker) return userResponse;

    return {
        success: true,
        data: {
            ...userResponse.data,
            [coworkerLimetype.name]: coworkerResponse.data || null,
        },
    };
}
