import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import {
    getBulkImportProperties,
    executeBulkImport,
} from './bulkImportCommons';

/**
 * Description and metadata for the "Update many objects" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Update Many Objects (Bulk)',
    value: 'bulkUpdateManyObjects',
    description:
        'Update multiple existing objects via bulk import. Skips business logic.',
    action: 'Update many objects (bulk)',
};

/**
 * Node properties for the "Update many objects" operation.
 *
 * @public
 */
export const properties: INodeProperties[] = getBulkImportProperties(
    'bulkUpdateManyObjects',
    true // Matching property needed for update
);

/**
 * Execute the "Update many objects" operation for Lime CRM.
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
    return executeBulkImport(this, i, 'update');
}
