import { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { getProperties, updateLimeobject } from '../../../transport';
import { DATA_RESOURCE, Limeobject } from '../../../models';
import {
	getFilePropertiesNames,
	processFileResponse,
	replaceNullTextValues,
	setFileProperties,
} from '../../../utils';
import { WorkflowFileResponse } from '../../../../response';
import { parseResourceMapperFields } from '../../../methods';

/**
 * Description and metadata for the "Update Single Object" operation in Lime CRM.
 *
 * @public
 */
export const description = {
	name: 'Update an Object',
	value: 'updateSingleObject',
	description: 'Update one specific object',
	action: 'Update an object',
};

/**
 * Node properties for the "Update Single Object" operation.
 *
 * @param {string} limetype - The type of entity to update. Loaded from available Limetypes
 * @param {string} id - The ID of the object to update
 * @param {'simple' | 'json'} inputType - How the object data is provided: 'simple' for form inputs, 'json' for raw JSON
 * @param {IDataObject} simpleFields - Used if `inputType` is 'simple'. List of field name/value pairs to update
 * @param {string} jsonData - Used if `inputType` is 'json'. Full object data in JSON format
 * @param {boolean} acceptNullForTexts - Whether `null` values of text properties are sent as empty strings
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
		description: 'The type of entity to update',
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
				operation: ['updateSingleObject'],
			},
		},
	},
	{
		displayName: 'Record ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the record to update',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['updateSingleObject'],
			},
		},
	},
	{
		displayName: 'Input',
		name: 'inputType',
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
		description: 'How to input the data',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['updateSingleObject'],
			},
		},
	},
	{
		displayName: 'Input (JSON)',
		name: 'jsonData',
		type: 'json',
		default: '{\n  "name": "Updated Company Name",\n  "phone": "+987654321"\n}',
		description:
			'Key-value pairs for fields to update. Property names must match the Lime CRM field names.',
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['updateSingleObject'],
				inputType: ['json'],
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
				resourceMapperMethod: 'getUpdateMappingColumns',
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
				operation: ['updateSingleObject'],
				inputType: ['fields'],
			},
		},
	},
	{
		displayName: 'Accept Null for Texts',
		name: 'acceptNullForTexts',
		type: 'boolean',
		default: false,
		description:
			'Accept that text fields in Lime CRM can be cleared also with null, and not only an empty string',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['updateSingleObject'],
			},
		},
	},
];

/**
 * Execute the "Update Single Object" operation for Lime CRM.
 *
 * @remarks
 * This method updates a single Lime CRM object identified by its ID and Limetype.
 * It supports two input methods:
 * - 'simple': key-value pairs provided via the UI
 * - 'json': full object data in JSON format
 *
 * The method performs the following steps:
 * 1. Retrieves the `limetype`, `id`, and input data from {@link properties}.
 * 2. Optionally replaces `null` values of text properties with empty strings.
 * 3. Collects and prepares any file properties using {@link getFilePropertiesNames} and {@link setFileProperties}.
 * 4. Calls {@link updateLimeobject} to update the object in Lime CRM.
 * 5. Processes the response, including file properties, using {@link processFileResponse}.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The updated Lime object data, optionally including file binary content.
 *
 * @public
 */
export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<WorkflowFileResponse<Limeobject>> {
	const limetype = this.getNodeParameter('limetype', i, undefined, {
		extractValue: true,
	}) as string;
	const id = this.getNodeParameter('id', i) as string;
	const inputType = this.getNodeParameter('inputType', i) as string;

	let body: IDataObject = {};

	const propertiesResponse = await getProperties(this, limetype);
	if (!propertiesResponse.success)
		return {
			json: propertiesResponse.data,
		};
	const properties = propertiesResponse.data;

	if (inputType === 'json') {
		const jsonData = this.getNodeParameter('jsonData', i) as string;
		body = JSON.parse(jsonData);
	} else {
		body = parseResourceMapperFields(this, i, 'properties');
	}

	const acceptNullForTexts = this.getNodeParameter('acceptNullForTexts', i, false) as boolean;
	if (acceptNullForTexts) {
		body = replaceNullTextValues(body, properties);
	}

	const fileProperties = getFilePropertiesNames(properties);

	await setFileProperties(this, i, fileProperties, body);

	const updateLimeobjectResponse = await updateLimeobject(this, limetype, id, body);
	if (!updateLimeobjectResponse.success)
		return {
			json: updateLimeobjectResponse.data,
		};

	const response = await processFileResponse<Limeobject>(
		this,
		fileProperties,
		updateLimeobjectResponse.data,
	);
	return {
		json: response.json.data,
		binary: response.binary,
	};
}
