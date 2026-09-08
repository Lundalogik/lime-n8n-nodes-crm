import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { User, ADMIN_RESOURCE } from '../../../models';
import { fetchSingleUserById, fetchSingleUserByLimeobjectId } from '../../../transport';
import { WorkflowResponse, APIResponse } from '../../../../response';
import { handleWorkflowError } from '../../../../errorHandling';

export const description = {
	name: 'Get Single User',
	value: 'getSingleUser',
	description: 'Get a single user data',
	action: 'Get single user',
};

/**
 * Node properties for the "Get Single User" operation.
 *
 * @param {string} id - The ID of the user to retrieve
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
				resource: [ADMIN_RESOURCE],
				operation: ['getSingleUser'],
			},
		},
		options: [
			{
				name: 'User ID',
				value: 'byUser',
				description: 'Get user by its ID',
			},
			{
				name: 'Limeobject ID',
				value: 'byLimeobject',
				description: "Get user by it's related Limeobject ID",
			},
		],
		default: 'byUser',
	},
	{
		displayName: 'Identifier',
		name: 'identifier',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the user or Limeobject to retrieve',
		displayOptions: {
			show: {
				resource: [ADMIN_RESOURCE],
				operation: ['getSingleUser'],
			},
		},
	},
	{
		displayName: 'Include Coworker',
		name: 'withCoworker',
		type: 'boolean',
		default: false,
		description: 'Whether to include coworker data in the response',
		displayOptions: {
			show: {
				resource: [ADMIN_RESOURCE],
				operation: ['getSingleUser'],
			},
		},
	},
];
/**
 * Execute the "Get Single Object" operation for Lime CRM.
 *
 * @remarks
 * This method retrieves a single Lime CRM user identified by its ID.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns User data.
 *
 * @public
 */
export async function execute(this: IExecuteFunctions, i: number): Promise<WorkflowResponse<User>> {
	const source = this.getNodeParameter('source', i) as string;
	const id = this.getNodeParameter('identifier', i) as string;
	const withCoworker = this.getNodeParameter('withCoworker', i) as boolean;

	let response: APIResponse<User>;

	if (source == 'byUser') {
		response = await fetchSingleUserById(this, id, withCoworker);
	} else if (source == 'byLimeobject') {
		response = await fetchSingleUserByLimeobjectId(this, id, withCoworker);
	} else {
		response = handleWorkflowError(this.getNode(), {
			message: `The source ${source} is not supported!`,
		});
	}

	return response.data;
}
