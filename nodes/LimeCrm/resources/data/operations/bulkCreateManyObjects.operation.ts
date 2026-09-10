import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { getBulkImportProperties, executeBulkImport } from './bulkImportCommons';

/**
 * Description and metadata for the "Create many objects" operation in Lime CRM.
 *
 * @public
 */
export const description = {
	name: 'Create Many Objects (Bulk)',
	value: 'bulkCreateManyObjects',
	description: 'Create multiple objects via bulk import. Skips business logic.',
	action: 'Create many objects (bulk)',
};

/**
 * Node properties for the "Create many objects" operation.
 *
 * @public
 */
export const properties: INodeProperties[] = getBulkImportProperties(
	'bulkCreateManyObjects',
	false, // Matching property is optional for create (can be used to skip duplicates)
);

/**
 * Execute the "Create many objects" operation for Lime CRM.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The bulk import job status and summary
 *
 * @public
 */
export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<IDataObject | undefined> {
	return executeBulkImport(this, i, 'create');
}
