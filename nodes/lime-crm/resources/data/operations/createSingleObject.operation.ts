import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { createLimeobject, getProperties } from '../../../transport';
import { DATA_RESOURCE } from '../../../models';
import {
    getFilePropertiesNames,
    processFileResponse,
    setFileProperties,
} from '../../../utils';

import { parseResourceMapperFields } from '../../../methods';

/**
 * Description and metadata for the "Create Single Object" operation in Lime CRM.
 *
 * @public
 */
export const description = {
    name: 'Create an Object',
    value: 'createSingleObject',
    description: 'Create a single new object',
    action: 'Create an object',
};

/**
 * Node properties for the "Create Single Object" operation.
 *
 * @param {string} limetype - The type of entity to create
 * @param {'fields' | 'json'} inputMethod - How the user provides object data: 'fields' for form inputs, 'json' for raw JSON
 * @param {Array<{ name: string; value: string }>} properties - Used if inputMethod is 'fields'. List of property name/value pairs to set on the object
 * @param {string} objectJson - Used if inputMethod is 'json'. The full object data in JSON format
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
        description: 'The type of entity to create',
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
                operation: ['createSingleObject'],
            },
        },
    },
    {
        displayName: 'Input',
        name: 'inputMethod',
        type: 'options',
        options: [
            {
                name: 'Form',
                value: 'fields',
                description: 'Define fields using the UI',
            },
            {
                name: 'JSON Object',
                value: 'json',
                description: 'Define fields using JSON',
            },
        ],
        default: 'fields',
        description: 'How to input the object data',
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['createSingleObject'],
            },
        },
    },
    {
        displayName: 'Input (Form)',
        name: 'properties',
        type: 'resourceMapper',
        placeholder: 'Add Property',
        typeOptions: {
            resourceMapper: {
                resourceMapperMethod: 'getCreateMappingColumns',
                mode: 'add',
                addAllFields: false,
                supportAutoMap: false,
            },
            loadOptionsDependsOn: ['limetype.value'],
        },
        default: {
            value: null,
        },
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['createSingleObject'],
                inputMethod: ['fields'],
            },
        },
    },
    {
        displayName: 'Input (JSON)',
        name: 'objectJson',
        type: 'json',
        default: '{\n  "name": "New Company",\n  "phone": "123-456-7890"\n}',
        description: 'Object to create in JSON format',
        displayOptions: {
            show: {
                resource: [DATA_RESOURCE],
                operation: ['createSingleObject'],
                inputMethod: ['json'],
            },
        },
        typeOptions: {
            alwaysOpenEditWindow: true,
        },
    },
];

/**
 * Execute the "Create Single Object" operation for Lime CRM.
 *
 * @param i - The index of the current item in the workflow execution
 * @remarks
 * This method handles creating a single Lime CRM object. It supports two input methods:
 * - `fields`: where the user provides property values via form fields.
 * - `json`: where the user provides a full JSON object representing the entity.
 *
 * The method performs the following steps:
 * 1. Reads the limetype and input method from node parameters.
 * 2. Parses input data according to the selected input method.
 * 3. Resolves any file properties present in the object and sets the file properties on the object.
 * 4. Sends a request to the Lime API to create the object.
 * 5. Processes any returned file data and formats the response.
 *
 * @returns The newly created Lime object.
 *
 * @public
 */
export async function execute(this: IExecuteFunctions, i: number) {
    const limetype = this.getNodeParameter('limetype', i, undefined, {
        extractValue: true,
    }) as string;
    const inputMethod = this.getNodeParameter('inputMethod', i) as string;

    let objectData: IDataObject;

    const propertiesResponse = await getProperties(this, limetype);
    if (!propertiesResponse.success) return propertiesResponse.data;

    const properties = propertiesResponse.data;

    if (inputMethod === 'json') {
        const jsonInput = this.getNodeParameter('objectJson', i) as string;
        objectData = JSON.parse(jsonInput);
    } else {
        objectData = parseResourceMapperFields(this, i, 'properties');
    }

    const fileProperties = getFilePropertiesNames(
        properties,
        new Set(Object.keys(objectData))
    );

    const setFilePropertiesResponse = await setFileProperties(
        this,
        i,
        fileProperties,
        objectData
    );
    if (!setFilePropertiesResponse.success)
        return setFilePropertiesResponse.data;

    const createLimeobjectResponse = await createLimeobject(
        this,
        limetype,
        setFilePropertiesResponse.data
    );
    if (!createLimeobjectResponse.success) return createLimeobjectResponse.data;

    const response = await processFileResponse(
        this,
        fileProperties,
        createLimeobjectResponse.data
    );
    return response.json.data;
}
