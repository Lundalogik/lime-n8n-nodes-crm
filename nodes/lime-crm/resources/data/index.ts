import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeProperties,
	NodePropertyTypes,
	NodeOperationError,
} from 'n8n-workflow';

import * as operations from './operations';

import { DATA_RESOURCE } from '../../models';
import { N8NOperationModuleHandler } from '../../../modules';

/**
 * List of modules consisting data operations
 */
const moduleHandler = new N8NOperationModuleHandler([
	operations.createSingleObject,
	operations.getSingleObject,
	operations.updateSingleObject,
	operations.deleteSingleObject,
	operations.getManyObjects,
	operations.getSingleFile,
	operations.bulkCreateManyObjects,
	operations.bulkUpdateManyObjects,
	operations.bulkCreateOrUpdateManyObjects,
]);

/**
 * Fields and operations for the **Data** resource in Lime CRM.
 *
 * @remarks
 * - These fields are displayed in the n8n node UI when the resource is set to `Data`.
 * - Each operation corresponds to a CRUD action or a file retrieval for Lime objects.
 *
 * @group Resources
 * @public
 *
 * @see {@link createSingleObject} - Operation to create a single Limeobject
 * @see {@link getSingleObject} - Operation to retrieve a single Limeobject by ID
 * @see {@link updateSingleObject} - Operation to update a single Limeobject by ID
 * @see {@link deleteSingleObject} - Operation to delete a single Limeobject by ID
 * @see {@link getManyObjects} - Operation to fetch multiple Limeobjects based on search criteria
 * @see {@link getSingleFile} - Operation to retrieve a single from Lime CRM
 */
export const dataFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options' as NodePropertyTypes,
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
			},
		},
		options: moduleHandler.getDescriptions(),
		default: 'getManyObjects',
	},

	...moduleHandler.getProperties(),
];

/**
 * Execute a specific **Data** operation on Lime CRM objects.
 *
 * @param args - Contextual parameters for the operation being executed
 * @param args.operation - The operation to perform (e.g., `createSingleObject`, `getManyObjects`)
 * @param args.i - The index of the input item to process
 *
 * @returns A promise resolving to the n8n object containing the result of the operation.
 *
 * @throws NodeOperationError if the operation is unsupported or fails.
 *
 * @public
 * @group Resources
 */
export async function dataOperations(
	this: IExecuteFunctions,
	{ operation, i }: { operation: string; i: number },
): Promise<INodeExecutionData | INodeExecutionData[] | undefined> {
	switch (operation) {
		case 'createSingleObject': {
			return {
				json: await operations.createSingleObject.execute.call(this, i),
			};
		}
		case 'getSingleObject': {
			return await operations.getSingleObject.execute.call(this, i);
		}
		case 'updateSingleObject': {
			return {
				...(await operations.updateSingleObject.execute.call(this, i)),
			};
		}
		case 'deleteSingleObject': {
			const response = await operations.deleteSingleObject.execute.call(this, i);
			return { json: response };
		}
		case 'getManyObjects': {
			const result = await operations.getManyObjects.execute.call(this, i);
			if (Array.isArray(result)) {
				return result.map((item) => ({
					json: item,
				}));
			} else {
				return {
					json: result,
				};
			}
		}
		case 'getSingleFile': {
			return await operations.getSingleFile.execute.call(this, i);
		}
		case 'bulkCreateManyObjects': {
			const result = await operations.bulkCreateManyObjects.execute.call(this, i);
			return result && { json: result };
		}
		case 'bulkUpdateManyObjects': {
			const result = await operations.bulkUpdateManyObjects.execute.call(this, i);
			return result && { json: result };
		}
		case 'bulkCreateOrUpdateManyObjects': {
			const result = await operations.bulkCreateOrUpdateManyObjects.execute.call(this, i);
			return result && { json: result };
		}
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported!`);
}

export * from './operations';
