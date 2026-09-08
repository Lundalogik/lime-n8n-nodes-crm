import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { deleteLimeobject } from '../../../transport';
import { DATA_RESOURCE } from '../../../models';
import { WorkflowResponse } from '../../../../response';

/**
 * Description and metadata for the "Delete Single Object" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Delete an Object',
    value: 'deleteSingleObject',
    description: 'Delete one specific object',
    action: 'Delete an object',
};

/**
 * Node properties for the "Delete Single Object" operation.
 *
 *
 * @param {string} limetype - The type of entity to delete. Loaded from available Limetypes
 * @param {string} objectId - The ID of the object to delete
 *
 * @public
 */
export const properties: INodeProperties[] = [
    {
        displayName: 'Limetype',
        name: 'limetype',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'The type of entity to delete',
        modes: [
            {
                displayName: 'From List',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'searchLimetypes',
                    searchable: true,
                },
            },
            {
                displayName: 'By Name',
                name: 'name',
                type: 'string',
                placeholder: 'e.g. company',
            },
        ],
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['deleteSingleObject'],
            },
        },
    },
    {
        displayName: 'Object ID',
        name: 'objectId',
        type: 'string',
        required: true,
        default: '',
        description: 'The ID of the object to delete',
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['deleteSingleObject'],
            },
        },
    },
];

/**
 * Execute the "Delete Single Object" operation for Lime CRM.
 *
 * @remarks
 * This operation deletes a single Lime CRM object identified by its object ID.
 * The object type is determined by the selected limetype.
 *
 * The method performs the following steps:
 * 1. Retrieves the `limetype` and `objectId` from {@link properties}.
 * 2. Calls the {@link deleteLimeobject} function to delete the object from Lime CRM.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The response from the Lime API after attempting deletion.
 *
 * @public
 */
export async function execute(
    this: IExecuteFunctions,
    i: number
): Promise<WorkflowResponse<Record<string, never>>> {
    const limetype = this.getNodeParameter('limetype', i, undefined, {
        extractValue: true,
    }) as string;
    const objectId = this.getNodeParameter('objectId', i) as string;

    const response = await deleteLimeobject(this, limetype, objectId);
    return response.data;
}
