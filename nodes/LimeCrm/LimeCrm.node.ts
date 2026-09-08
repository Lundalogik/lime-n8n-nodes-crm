import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodePropertyTypes,
} from 'n8n-workflow';

import { toNodeError } from '../errorHandling';
import { metadataFields, metadataOperations } from './resources/metadata';
import { adminFields, adminOperations } from './resources/admin';
import { dataFields, dataOperations } from './resources/data';

import {
	ADMIN_RESOURCE,
	DATA_RESOURCE,
	METADATA_RESOURCE,
	LIME_CRM_API_CREDENTIAL_KEY,
} from './models';

import {
	getFileProperties,
	getLimetypeProperties,
	searchLimetypes,
	getNoHasManyProperties,
	getRelationProperties,
	getCreateMappingColumns,
	getUpdateMappingColumns,
	getRelationLookupMappingColumns,
	getRelationPropertiesWithLookupField,
} from './methods';

/**
 * Representation of a function that executes a specific Lime CRM operation.
 *
 * This function type is used by the Lime CRM node to dynamically invoke
 * the appropriate handler (e.g., metadata or data operations) during node execution.
 *
 * @param this - The n8n {@link IExecuteFunctions} context, providing access to
 * node parameters, credentials, and helper methods.
 * @param args - The arguments used for the operation.
 * @param args.operation - The name of the operation to execute (e.g., "getAll", "create").
 * @param args.i - The index of the current item being processed in the n8n execution loop.
 *
 * @returns A promise that resolves with the result of the operation.
 *
 * @public
 * @group Node Definition
 */
type OperationFn = (
	this: IExecuteFunctions,
	args: { operation: string; i: number },
) => Promise<unknown>;

/**
 * The main n8n node for interacting with the Lime CRM API.
 *
 * Provides two resource groups:
 * - **Metadata**: Allows interaction with the structure of available Limetypes and their properties.
 * - **Data**: Enables operations on Lime CRM data objects.
 *
 * The node dynamically loads available Lime CRM resources and properties and routes
 * executions to the appropriate operation handlers.
 *
 * @remarks
 * This node uses {@link metadataOperations} and {@link dataOperations} to process workflow executions
 * based on the selected resource and operation.
 *
 * @public
 * @group Node Definition
 */
export class LimeCrm implements INodeType {
	/**
	 * Node configuration and metadata, defining available resources, operations, and credentials.
	 * Describes how the Lime CRM node appears and behaves in the n8n editor.
	 *
	 * @see {@link https://docs.n8n.io/integrations/creating-nodes/#node-description}
	 */
	description: INodeTypeDescription = {
		displayName: 'Lime CRM',
		name: 'limeCrm',
		documentationUrl:
			'https://platform.docs.lime-crm.com/en/latest/workflows-and-integrations/node-reference/',
		icon: 'file:assets/lime-crm.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Lime CRM API',
		defaults: {
			name: 'Lime CRM',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: LIME_CRM_API_CREDENTIAL_KEY,
				required: true,
			},
		],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options' as NodePropertyTypes,
				noDataExpression: true,
				options: [
					{
						name: 'Metadata',
						value: METADATA_RESOURCE,
						description: 'Work with the structure of available ' + 'Limetypes and their properties',
					},
					{
						name: 'Data',
						value: DATA_RESOURCE,
						description: 'Work with CRM data',
					},
					{
						name: 'Admin',
						value: ADMIN_RESOURCE,
						description: 'Work with administrative data',
					},
				],
				default: DATA_RESOURCE,
			},

			...(metadataFields as INodeProperties[]),
			...(dataFields as INodeProperties[]),
			...(adminFields as INodeProperties[]),
		],
	};

	/**
	 * Methods used by the Lime CRM node to load dynamic options in the n8n UI.
	 *
	 * @remarks
	 * These functions are used to populate dropdowns and lists in the node's
	 * parameter editor. For details, see:
	 * - {@link searchLimetypes}
	 * - {@link getFileProperties}
	 * - {@link getLimetypeProperties}
	 * - {@link getNoHasManyProperties}
	 * - {@link getUpdateMappingColumns}
	 * - {@link getCreateMappingColumns}
	 */
	methods = {
		loadOptions: {
			getLimetypeProperties,
			getFileProperties,
			getNoHasManyProperties,
			getRelationProperties,
			getRelationPropertiesWithLookupField,
		},
		listSearch: {
			searchLimetypes,
		},
		resourceMapping: {
			getUpdateMappingColumns,
			getCreateMappingColumns,
			getRelationLookupMappingColumns,
		},
	};

	/**
	 * Execute the selected operation for the configured resource.
	 *
	 * Routes the execution to either {@link metadataOperations} or {@link dataOperations},
	 * based on the user’s selection in the n8n UI.
	 *
	 * @returns A two-dimensional array of execution data for downstream nodes.
	 *
	 * @throws Error - Will throw an error if execution fails and `continueOnFail` is not enabled
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		let returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let operationFn: OperationFn | undefined;
		switch (resource) {
			case METADATA_RESOURCE: {
				operationFn = metadataOperations;
				break;
			}
			case DATA_RESOURCE: {
				operationFn = dataOperations;
				break;
			}
			case ADMIN_RESOURCE: {
				operationFn = adminOperations;
				break;
			}
		}

		for (let i = 0; i < items.length; i++) {
			if (!operationFn) continue;
			try {
				const responseData = (await operationFn.call(this, {
					operation,
					i,
				})) as INodeExecutionData | INodeExecutionData[] | undefined;
				if (responseData !== undefined) {
					returnData = returnData.concat(responseData);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: {}, error: error.message });
					continue;
				}
				throw toNodeError(this.getNode(), error);
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}

export { LimeCrmTrigger } from './LimeCrmTrigger.node';
