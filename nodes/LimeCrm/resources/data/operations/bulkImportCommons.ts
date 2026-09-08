import {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	LoggerProxy as Logger,
	NodeOperationError,
} from 'n8n-workflow';
import { DATA_RESOURCE } from '../../../models';
import {
	BulkImportJobPayload,
	BulkImportMode,
	BulkImportPayloadObject,
	createBulkImportJob,
	uploadBulkImportData,
	waitForBulkImportJob,
} from '../../../transport';
import { parseResourceMapperFields } from '../../../methods';

export type BulkImportOperationName =
	| 'bulkCreateManyObjects'
	| 'bulkCreateOrUpdateManyObjects'
	| 'bulkUpdateManyObjects';

/**
 * Generate common properties for bulk import operations.
 * @param operationName - The operation value to show these properties for
 * @param matchingPropertyRequired - Whether the matching property field is required (true for update/create_or_update, false for create)
 */
export function getBulkImportProperties(
	operationName: BulkImportOperationName,
	matchingPropertyRequired: boolean,
): INodeProperties[] {
	const resourceMapperMethod =
		operationName === 'bulkUpdateManyObjects'
			? 'getUpdateMappingColumns'
			: 'getCreateMappingColumns';

	return [
		{
			displayName:
				'<h1>Alpha</h1>' +
				'This feature is in alpha and will eventually change and require manual fixes to this node.<br>' +
				'<br>' +
				'The package <b>limepkg-mbeku-bulk-import >=1.4.1,<2.0.</b> must be installed in the solution.<br>' +
				'<br>' +
				'⚠️ Skips business logic such as automations, custom lime objects, webhooks and sql-on-update.',
			name: 'alphaNotice',
			type: 'notice',
			displayOptions: {
				show: {
					resource: [DATA_RESOURCE],
					operation: [operationName],
				},
			},
			default: '',
		},
		{
			displayName: 'Limetype',
			name: 'limetype',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
			description: 'The type of object to import',
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
					operation: [operationName],
				},
			},
		},
		{
			displayName: 'Matching Property Name or ID',
			name: 'matchingProperty',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getNoHasManyProperties',
				loadOptionsDependsOn: ['limetype.value'],
			},
			required: matchingPropertyRequired,
			default: '',
			description:
				'The property to use to match existing objects. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			hint: matchingPropertyRequired
				? 'Must be a unique property'
				: 'Optional: if set, objects matching an existing record will be skipped',
			displayOptions: {
				show: {
					resource: [DATA_RESOURCE],
					operation: [operationName],
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
			description: 'How to input the data',
			displayOptions: {
				show: {
					resource: [DATA_RESOURCE],
					operation: [operationName],
				},
			},
		},
		{
			displayName: 'Input (JSON)',
			name: 'objectJson',
			type: 'json',
			default: '{\n  "name": "Company Name",\n  "phone": "+987654321"\n}',
			description:
				'Object data in JSON format. Property names must match the Lime CRM field names.',
			typeOptions: {
				alwaysOpenEditWindow: true,
			},
			displayOptions: {
				show: {
					resource: [DATA_RESOURCE],
					operation: [operationName],
					inputMethod: ['json'],
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
					resourceMapperMethod: resourceMapperMethod,
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
					operation: [operationName],
					inputMethod: ['fields'],
				},
			},
		},
		{
			displayName: 'Relation Lookups',
			name: 'relationLookups',
			type: 'resourceMapper',
			placeholder: 'Add Relation Lookup',
			description:
				'For relation fields (belongsto/hasone), specify which property on the related object to use for matching',
			typeOptions: {
				resourceMapper: {
					resourceMapperMethod: 'getRelationLookupMappingColumns',
					mode: 'add',
					addAllFields: true,
					supportAutoMap: false,
					valuesLabel: 'Relation Lookups',
				},
				loadOptionsDependsOn: ['limetype.value'],
			},
			default: {
				value: null,
			},
			displayOptions: {
				show: {
					resource: [DATA_RESOURCE],
					operation: [operationName],
					inputMethod: ['fields'],
				},
			},
		},
	];
}

/**
 * Read the JSON input for one item. A `json` parameter driven by an expression
 * can already resolve to an object, so only strings are parsed.
 *
 * @param context - The n8n execution context
 * @param idx - The index of the input item to read the parameter for
 */
function parseJsonParam(context: IExecuteFunctions, idx: number): IDataObject {
	const raw = context.getNodeParameter('objectJson', idx) as string;
	return JSON.parse(raw) as IDataObject;
}

/**
 * Wrap one entry from the JSON input in the `values` envelope the bulk import
 * API expects. The field holds bare property maps; the envelope is ours to add.
 *
 * @param context - The n8n execution context
 * @param raw - The parsed JSON entry
 */
function toPayloadObject(context: IExecuteFunctions, raw: IDataObject): BulkImportPayloadObject {
	return { values: raw as IDataObject };
}

/**
 * Build the upload payload for the whole input batch.
 *
 * A top-level array in the JSON field is the complete payload, so the field is
 * read once; otherwise it is evaluated per input item, since expressions
 * resolve differently for each one. Either way every entry gets wrapped.
 *
 * @param context - The n8n execution context
 * @param inputMethod - Whether data comes from the JSON field or the form
 * @param itemCount - The number of input items in the batch
 */
function getBody(
	context: IExecuteFunctions,
	inputMethod: string,
	itemCount: number,
): BulkImportPayloadObject[] {
	if (inputMethod !== 'json') {
		return Array.from({ length: itemCount }, (_, idx) => ({
			values: parseResourceMapperFields(context, idx, 'properties'),
		}));
	}

	const first = parseJsonParam(context, 0);
	if (Array.isArray(first)) {
		return first.map((element, _) => toPayloadObject(context, element));
	}

	return Array.from({ length: itemCount }, (_, idx) =>
		toPayloadObject(context, parseJsonParam(context, idx)),
	);
}

/**
 * Execute a bulk import operation for Lime CRM.
 *
 * @param context - The n8n execution context
 * @param i - The index of the current item in the workflow execution
 * @param mode - The bulk import mode: 'create', 'update', or 'create_or_update'
 *
 * @returns The bulk import job status and summary
 */
export async function executeBulkImport(
	context: IExecuteFunctions,
	i: number,
	mode: BulkImportMode,
): Promise<IDataObject | undefined> {
	if (i > 0) {
		return undefined;
	}

	const limetype = context.getNodeParameter('limetype', i, undefined, {
		extractValue: true,
	}) as string;
	const inputMethod = context.getNodeParameter('inputMethod', i) as string;
	const items = context.getInputData();

	// Matching property is always available but optional for create mode
	const matchingProperty = context.getNodeParameter('matchingProperty', i, '') as string;

	Logger.info(
		`Preparing bulk import (${mode}) of ${items.length} objects for limetype: ${limetype}`,
	);

	// Step 1: Prepare the body for all items
	const body = getBody(context, inputMethod, items.length);

	// Step 2: Derive the property whitelist from the payload itself, so the
	// job metadata can never disagree with the uploaded file
	let propertiesToImport = Object.keys(body[0].values);

	if (inputMethod !== 'json') {
		// Apply relation lookups: replace property names with lookup paths (e.g., 'coworker' -> 'coworker.email')
		// The relationLookups is a resource mapper where keys are relation property names
		// and values are the lookup property names on the related limetype
		const relationLookupsData = parseResourceMapperFields(context, 0, 'relationLookups');

		const lookupMap = new Map<string, string>();
		for (const [relationProp, lookupProp] of Object.entries(relationLookupsData)) {
			if (lookupProp && typeof lookupProp === 'string') {
				lookupMap.set(relationProp, `${relationProp}.${lookupProp}`);
			}
		}

		propertiesToImport = propertiesToImport.map((prop) => lookupMap.get(prop) || prop);
	}

	Logger.info(`Properties to import: ${propertiesToImport.join(', ')}`);

	// Step 3: Create the bulk import job
	const jobPayload: BulkImportJobPayload = {
		mode,
		limetype,
		...(matchingProperty && { matchingProperty }),
		properties: propertiesToImport,
	};

	const jobResponse = await createBulkImportJob(context, jobPayload);
	const jobId = jobResponse.id;

	// Step 4: Upload the data file
	await uploadBulkImportData(context, jobId, body);

	// Step 5: Poll for completion
	const finalStatus = await waitForBulkImportJob(context, jobId, 2500);

	if (finalStatus.status === 'failed') {
		throw new NodeOperationError(context.getNode(), 'The bulk import job failed', {
			message: 'The bulk import job failed due to a server error.',
			description: `Bulk import job with ID ${jobId} has failed. Check the Lime CRM server for more details.`,
		});
	}

	// Step 6: Return the results summary
	return {
		jobId,
		status: finalStatus.status,
		startedAt: finalStatus.startedAt,
		finishedAt: finalStatus.endedAt,
		summary: finalStatus.result || {
			total: 0,
			created: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
		},
		taskId: finalStatus.extras?.task_id || finalStatus.extras?.taskId,
	};
}
