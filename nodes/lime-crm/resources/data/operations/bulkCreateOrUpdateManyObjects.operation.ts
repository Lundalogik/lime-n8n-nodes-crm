import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import {
    getBulkImportProperties,
    executeBulkImport,
} from './bulkImportCommons';

/**
 * Description and metadata for the "Create or update many objects" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Create or Update Many Objects (Bulk)',
    value: 'bulkCreateOrUpdateManyObjects',
    description:
        'Create or update multiple objects via bulk import. Skips business logic.',
    action: 'Create or update many objects (bulk)',
};

/**
 * Node properties for the "Create or update many objects" operation.
 *
 * @public
 */
export const properties: INodeProperties[] = getBulkImportProperties(
    'bulkCreateOrUpdateManyObjects',
    true // Matching property needed for create_or_update
);

/**
 * Execute the "Create or update many objects" operation for Lime CRM.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The bulk import job status and summary
 *
 * @public
 */
export async function execute(
    this: IExecuteFunctions,
    i: number
): Promise<IDataObject | undefined> {
    return executeBulkImport(this, i, 'create_or_update');
}
