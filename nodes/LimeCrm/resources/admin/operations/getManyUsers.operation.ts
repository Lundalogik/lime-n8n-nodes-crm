import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import {
	User,
	UserType,
	ADMIN_RESOURCE,
	NullOptionType,
	DEFAULT_API_OBJECT_LIMIT,
} from '../../../models';
import { fetchManyUsers } from '../../../transport';
import { WorkflowResponse } from '../../../../response';

export const description = {
	name: 'Get Many Users',
	value: 'getManyUsers',
	description: 'Get a list of users in the system',
	action: 'Get many users',
};

/**
 * Node properties for the "Get Many Users" operation.
 *
 * @param {boolean | null} id - Filter only active or inactive users
 * @param {UserType} userType  - Filter by User Type
 * @param {number} limit - Set a limit for how many users should the API return
 *
 * @public
 */
export const properties: INodeProperties[] = [
	{
		displayName: 'Active',
		name: 'active',
		type: 'options',
		description: 'Filter only active or inactive users',
		default: '',
		displayOptions: {
			show: {
				resource: [ADMIN_RESOURCE],
				operation: ['getManyUsers'],
			},
		},
		options: [
			{
				name: '',
				value: '',
			},
			{
				name: 'Active',
				value: true,
			},
			{
				name: 'Inactive',
				value: false,
			},
		],
	},
	{
		displayName: 'User Type',
		name: 'userType',
		type: 'options',
		description: 'Get only selected user types',
		displayOptions: {
			show: {
				resource: [ADMIN_RESOURCE],
				operation: ['getManyUsers'],
			},
		},
		default: '',
		options: [
			{
				name: '',
				value: '',
			},
			{
				name: 'Administration',
				value: 'ADMINISTRATION',
			},
			{
				name: 'API',
				value: 'API',
			},
			{
				name: 'Integration',
				value: 'INTEGRATION',
			},
			{
				name: 'Service',
				value: 'SERVICE',
			},
			{
				name: 'Standard',
				value: 'STANDARD',
			},
			{
				name: 'Synchronization',
				value: 'SYNCHRONIZATION',
			},
			{
				name: 'Test',
				value: 'TEST',
			},
		],
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: [ADMIN_RESOURCE],
				operation: ['getManyUsers'],
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
				operation: ['getManyUsers'],
			},
		},
	},
];

/**
 * Execute the "Get Many Users" operation for Lime CRM.
 *
 * @remarks
 * This method retrieves many Lime CRM users with properties, if provided.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns User data.
 *
 * @public
 */

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<WorkflowResponse<User[]>> {
	const active = this.getNodeParameter('active', i) as boolean | NullOptionType;
	const userType = this.getNodeParameter('userType', i) as UserType | NullOptionType;
	const limit =
		(this.getNodeParameter('limit', i, DEFAULT_API_OBJECT_LIMIT) as number) ||
		DEFAULT_API_OBJECT_LIMIT;
	const withCoworker = this.getNodeParameter('withCoworker', i, false) as boolean;
	const response = await fetchManyUsers(this, active, userType, limit, withCoworker);
	return response.data;
}
