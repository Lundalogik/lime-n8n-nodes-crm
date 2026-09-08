import {
    INodeExecutionData,
    IExecuteFunctions,
    INodeProperties,
    NodePropertyTypes,
    NodeOperationError,
} from 'n8n-workflow';

import * as operations from './operations';

import { ADMIN_RESOURCE, User } from '../../models';
import { N8NOperationModuleHandler } from '../../../modules';

const moduleHandler = new N8NOperationModuleHandler([
    operations.getManyUsers,
    operations.getSingleUser,
]);

/**
 * Fields and operations for the **Admin** resource in Lime CRM.
 *
 * @remarks
 * - These fields are displayed in the n8n node UI when the resource is set to `Admin`.
 * - Each operation corresponds to a CRUD action.
 *
 * @group Resources
 * @public
 *
 * @see {@link getManyUsers} - Operation to retrieve many Lime CRM users' data
 * @see {@link getSingleUser} - Operation to retrieve a single user from Lime CRM
 */
export const adminFields: INodeProperties[] = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options' as NodePropertyTypes,
        noDataExpression: true,
        displayOptions: {
            show: {
                resource: [ADMIN_RESOURCE],
            },
        },
        options: moduleHandler.getDescriptions(),
        default: 'getSingleUser',
    },

    ...moduleHandler.getProperties(),
];

/**
 * Execute a specific **Admin** operation on Lime CRM objects.
 *
 * @param args - Contextual parameters for the operation being executed
 * @param args.operation - The operation to perform (e.g., `getSingleUser`, `getManyUsers`)
 * @param args.i - The index of the input item to process
 *
 * @returns A promise resolving to the n8n object containing the result of the operation.
 *
 * @throws NodeOperationError if the operation is unsupported or fails.
 *
 * @public
 * @group Resources
 */
export async function adminOperations(
    this: IExecuteFunctions,
    { operation, i }: { operation: string; i: number }
): Promise<INodeExecutionData | INodeExecutionData[]> {
    switch (operation) {
        case 'getManyUsers': {
            const result = await operations.getManyUsers.execute.call(this, i);
            if (Array.isArray(result)) {
                return result.map((item: User) => ({
                    json: item,
                }));
            } else {
                return {
                    json: result,
                };
            }
        }
        case 'getSingleUser': {
            return {
                json: await operations.getSingleUser.execute.call(this, i),
            };
        }
    }

    throw new NodeOperationError(
        this.getNode(),
        `The operation "${operation}" is not supported!`
    );
}

export * from './operations';
