import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { getLimeobject, getProperties } from '../../../transport';
import { DATA_RESOURCE, Limeobject } from '../../../models';
import { getFilePropertiesNames, processFileResponse } from '../../../utils';
import { WorkflowFileResponse } from '../../../../response';
/**
 * Description and metadata for the "Get Single Object" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Get an Object',
    value: 'getSingleObject',
    description: 'Get one specific object',
    action: 'Get an object',
};

/**
 * Node properties for the "Get Single Object" operation.
 *
 * @param {string} limetype - The type of entity to retrieve. Loaded from available Limetypes
 * @param {string} objectId - The ID of the object to retrieve
 * @param {boolean} includeFileContent - Whether to include file binary data for Limetypes that have file properties. Ignored for Limetypes without file properties
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
        description: 'The type of entity to retrieve',
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
                operation: ['getSingleObject'],
            },
        },
    },

    {
        displayName: 'Object ID',
        name: 'objectId',
        type: 'string',
        required: true,
        default: '',
        description: 'The ID of the object to retrieve',
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['getSingleObject'],
            },
        },
    },
    {
        displayName: 'Include file content',
        name: 'includeFileContent',
        type: 'boolean',
        default: false,
        description:
            'Include file binary data if the Limetype has any file properties. ' +
            'Keep performance in mind before activating this. ' +
            'For Limetypes without any file properties, this setting is ignored.',
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['getSingleObject'],
            },
        },
    },
];

/**
 * Execute the "Get Single Object" operation for Lime CRM.
 *
 * @remarks
 * This method retrieves a single Lime CRM object identified by its object ID and Limetype.
 * If `includeFileContent` is true, it also retrieves binary data for any file properties of the object.
 *
 * The method performs the following steps:
 * 1. Retrieves the `limetype`, `objectId`, and `includeFileContent` from {@link properties}.
 * 2. Calls {@link getLimeobject} to fetch the object from Lime CRM.
 * 3. If the object has file properties and `includeFileContent` is true, it retrieves file data using {@link getFilePropertiesNames} and {@link processFileResponse}.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The Lime object data, optionally including file binary content.
 *
 * @public
 */
export async function execute(
    this: IExecuteFunctions,
    i: number
): Promise<WorkflowFileResponse<Limeobject>> {
    const limetype = this.getNodeParameter('limetype', i, undefined, {
        extractValue: true,
    }) as string;
    const objectId = this.getNodeParameter('objectId', i) as string;
    const includeFileContent = this.getNodeParameter(
        'includeFileContent',
        i
    ) as boolean;

    const limeObjectResponse = await getLimeobject(this, limetype, objectId);
    if (!limeObjectResponse.success) return { json: limeObjectResponse.data };

    const propertiesResponse = await getProperties(this, limetype);
    if (!propertiesResponse.success) return { json: propertiesResponse.data };

    const fileProperties = getFilePropertiesNames(propertiesResponse.data);
    const fileResponse = await processFileResponse<Limeobject>(
        this,
        fileProperties,
        limeObjectResponse.data,
        includeFileContent
    );
    return {
        json: fileResponse.json.data,
        binary: fileResponse.binary,
    };
}
