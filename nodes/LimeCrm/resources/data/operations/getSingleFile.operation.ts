import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import { getFileContent, getFileContentByLimetype } from '../../../transport';
import { DATA_RESOURCE } from '../../../models';

/**
 * Description and metadata for the "Get Single File" operation in Lime CRM.
 *
 * @public
 */
export const description = {
	name: 'Get a File',
	value: 'getSingleFile',
	description: 'Get the file data for one specific file',
	action: 'Get a file',
};

/**
 * Node properties for the "Get Single File" operation.
 *
 * @param {('byFile' | 'byLimeobject')} source - Determines if the file should be fetched by its file ID or by its associated Limeobject ID
 * @param {string} limetype - Required if fetching by Limeobject. Specifies the type of Lime CRM entity associated with the file
 * @param {string} identifier - The ID of the file or the associated Limeobject to retrieve
 * @param {string} property - Required if fetching by Limeobject. Specifies the file type property to fetch
 *
 * @public
 */
export const properties: INodeProperties[] = [
	{
		displayName: 'Get By',
		name: 'source',
		type: 'options',
		required: true,
		placeholder: 'Add Source',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getSingleFile'],
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
				resource: [DATA_RESOURCE],
				operation: ['getSingleFile'],
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
				resource: [DATA_RESOURCE],
				operation: ['getSingleFile'],
			},
		},
		placeholder: 'e.g., 12345',
	},
	{
		displayName: 'File Type Property Name or ID',
		name: 'property',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getFileProperties',
			loadOptionsDependsOn: ['limetype.value'],
		},
		required: true,
		default: '',
		description:
			'The type of entity associated with the file. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getSingleFile'],
				source: ['byLimeobject'],
			},
		},
	},
];

/**
 * Execute the "Get Single File" operation for Lime CRM.
 *
 * @remarks
 * This method retrieves file data from Lime CRM based on the selected source:
 * - 'byFile': Fetches the file using its unique file ID.
 * - 'byLimeobject': Fetches the file using an associated Limeobject ID and the specified file type property.
 *
 * The method returns an object containing the JSON response and the file's binary data.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns An object containing `json` and `binary` fields with the file data.
 *
 * @public
 */
export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData> {
	const source = this.getNodeParameter('source', i) as string;
	const id = this.getNodeParameter('identifier', i) as string;

	if (source == 'byFile') {
		const fileResponse = await getFileContent(this, id);
		if (!fileResponse.success)
			return {
				json: fileResponse.data,
			};
		return {
			json: {},
			binary: { data: fileResponse.data },
		};
	}
	if (source == 'byLimeobject') {
		const limetype = this.getNodeParameter('limetype', i, undefined, {
			extractValue: true,
		}) as string;
		const property = this.getNodeParameter('property', i) as string;

		const fileResponse = await getFileContentByLimetype(this, limetype, id, property);
		if (!fileResponse.success)
			return {
				json: fileResponse.data,
			};

		return {
			json: {},
			binary: {
				data: fileResponse.data,
			},
		};
	}

	throw new NodeOperationError(this.getNode(), `The source "${source}" is not supported!`);
}
