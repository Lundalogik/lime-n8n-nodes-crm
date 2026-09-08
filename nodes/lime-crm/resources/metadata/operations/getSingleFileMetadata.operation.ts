import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import {
    FileMetadata,
    getFileMetadata,
    getFileMetadataByLimeobject,
} from '../../../transport';
import { METADATA_RESOURCE } from '../../../models';
import { APIResponse, WorkflowResponse } from '../../../../response';
import { handleWorkflowError } from '../../../../errorHandling';

/**
 * Description and metadata for the "Get Single File Metadata" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Get File Metadata',
    value: 'getSingleFileMetadata',
    description: 'Get the metadata for a single file',
    action: 'Get file metadata',
};

/**
 * Node parameter definitions for the "Get Single File Metadata" operation.
 *
 * @param source - Determines whether the file is retrieved by its ID or by its associated Limeobject ID
 * @param limetype - The Lime CRM entity type associated with the file (required when `source` is `byLimeobject`)
 * @param identifier - The unique identifier of the file or Limeobject to retrieve metadata for
 * @param property - The file property in the Limeobject containing the file reference (used when `source` is `byLimeobject`)
 *
 * @public
 */
export const properties: INodeProperties[] = [
    {
        displayName: 'Get by',
        name: 'source',
        type: 'options',
        required: true,
        placeholder: 'Add Source',
        displayOptions: {
            show: {
                resource: [METADATA_RESOURCE],
                operation: ['getSingleFileMetadata'],
            },
        },
        options: [
            {
                name: 'File ID',
                value: 'byFile',
                description: 'Get file by its ID',
            },
            {
                name: 'Limeobject ID',
                value: 'byLimeobject',
                description: "Get file by it's associated Limeobject ID",
            },
        ],
        default: 'byFile',
    },
    {
        displayName: 'Limetype',
        name: 'limetype',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'The type of entity associated with the file',
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
                resource: [METADATA_RESOURCE],
                operation: ['getSingleFileMetadata'],
                source: ['byLimeobject'],
            },
        },
    },
    {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        required: true,
        default: '',
        description: 'The ID of the file or Limeobject to retrieve',
        displayOptions: {
            show: {
                resource: [METADATA_RESOURCE],
                operation: ['getSingleFileMetadata'],
            },
        },
        placeholder: 'e.g., 12345',
    },
    {
        displayName: 'File type property',
        name: 'property',
        type: 'options',
        typeOptions: {
            loadOptionsMethod: 'getFileProperties',
            loadOptionsDependsOn: ['limetype.value'],
        },
        required: true,
        default: '',
        description: 'The type of entity associated with the file',
        displayOptions: {
            show: {
                resource: [METADATA_RESOURCE],
                operation: ['getSingleFileMetadata'],
                source: ['byLimeobject'],
            },
        },
    },
];

/**
 * Execute the "Get Single File Metadata" operation.
 *
 * Retrieves file metadata either directly via its file ID, or through its associated Limeobject.
 * The function dynamically calls the correct method depending on user configuration.
 *
 * @param i - The index of the current item being processed within the n8n execution loop.
 * @returns File metadata
 *
 * @public
 */
export async function execute(
    this: IExecuteFunctions,
    i: number
): Promise<WorkflowResponse<FileMetadata>> {
    const source = this.getNodeParameter('source', i) as string;
    const id = this.getNodeParameter('identifier', i) as string;
    let response: APIResponse<FileMetadata>;

    if (source == 'byFile') {
        response = await getFileMetadata(this, id);
    } else if (source == 'byLimeobject') {
        const limetype = this.getNodeParameter('limetype', i, undefined, {
            extractValue: true,
        }) as string;
        const property = this.getNodeParameter('property', i) as string;
        response = await getFileMetadataByLimeobject(
            this,
            limetype,
            id,
            property
        );
    } else {
        response = handleWorkflowError(this.getNode(), {
            message: `The source "${source}" is not supported`,
        });
    }
    return response.data;
}
