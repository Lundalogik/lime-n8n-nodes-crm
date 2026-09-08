import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { getLimetype } from '../../../transport';
import { Limetype, METADATA_RESOURCE } from '../../../models';
import { WorkflowResponse } from '../../../../response';

/**
 * Description and metadata for the "Get Single Limetype" operation in Lime CRM.
 *
 * @public
 */
export const description = {
	name: 'Get a Limetype',
	value: 'getSingleLimetype',
	description: 'Get details about a specific Limetype',
	action: 'Get a Limetype',
};

/**
 * Node parameter definitions for the "Get Single Limetype" operation.
 *
 * @param limetype - The name of the entity type (Limetype) to retrieve details for
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
		description: 'The name of the entity type to get details for',
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
				operation: ['getSingleLimetype'],
			},
		},
	},
];

/**
 * Execute the "Get Single Limetype" operation.
 *
 * Retrieves detailed information about a specific Limetype from Lime CRM.
 *
 * @param i - The index of the current item being processed within the n8n execution loop.
 * @returns Limetype details as returned from the API.
 *
 * @public
 */
export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<WorkflowResponse<Limetype>> {
	const limetype = this.getNodeParameter('limetype', i, undefined, {
		extractValue: true,
	}) as string;

	const response = await getLimetype(this, limetype);
	return response.data;
}
