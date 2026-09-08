import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeProperties,
	NodePropertyTypes,
	NodeOperationError,
} from 'n8n-workflow';

import * as operations from './operations';
import { METADATA_RESOURCE } from '../../models';
import { N8NOperationModuleHandler } from '../../../modules';

const moduleHandler = new N8NOperationModuleHandler([
	operations.getAllLimetypes,
	operations.getSingleLimetype,
	operations.getSingleFileMetadata,
]);

/**
 * Fields and operations for the **Metadata** resource in Lime CRM.
 *
 * @remarks
 * - These fields are displayed in the n8n node UI when the resource is set to `Metadata`.
 * - Each operation corresponds to fetching or inspecting metadata in Lime CRM.
 *
 * @group Resources
 * @public
 *
 * @see {@link getAllLimetypes} - Operation to retrieve a list of all available Limetypes
 * @see {@link getSingleLimetype} - Operation to retrieve details about a specific Limetype
 * @see {@link getSingleFileMetadata} - Operation to fetch metadata for a specific file
 */
export const metadataFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options' as NodePropertyTypes,
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [METADATA_RESOURCE],
			},
		},
		options: moduleHandler.getDescriptions(),
		default: 'getAllLimetypes',
	},

	...moduleHandler.getProperties(),
];

/**
 * Execute a specific **Metadata** operation on Lime CRM.
 *
 * @param args - Contextual parameters for the operation being executed
 * @param args.operation - The operation to perform (e.g., `getAllLimetypes`, `getSingleLimetype`)
 * @param args.i - The index of the input item to process
 *
 * @returns A promise resolving to the n8n object containing the result of the operation.
 *
 * @throws NodeOperationError if the operation is unsupported or fails.
 *
 * @public
 * @group Resources
 */
export async function metadataOperations(
	this: IExecuteFunctions,
	{ operation, i }: { operation: string; i: number },
): Promise<INodeExecutionData | INodeExecutionData[]> {
	switch (operation) {
		case 'getAllLimetypes': {
			const results = await operations.getAllLimetypes.execute.call(this);
			if (Array.isArray(results)) {
				return results.map((limetype) => ({
					json: limetype,
				}));
			} else {
				return { json: results };
			}
		}
		case 'getSingleLimetype': {
			return {
				json: await operations.getSingleLimetype.execute.call(this, i),
			};
		}
		case 'getSingleFileMetadata': {
			return {
				json: await operations.getSingleFileMetadata.execute.call(this, i),
			};
		}
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported!`);
}

export * from './operations';
