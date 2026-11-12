import { IExecuteFunctions, INode, INodeProperties, NodeOperationError } from 'n8n-workflow';

import { IncludedProperties, queryLimeobjects } from '../../../transport';
import { DATA_RESOURCE, DEFAULT_API_OBJECT_LIMIT } from '../../../models';
import { WorkflowResponse } from '../../../../response';

/**
 * Description and metadata for the "Get Many Objects" operation in Lime CRM.
 *
 * @public
 */
export const description = {
	name: 'Get Many Objects',
	value: 'getManyObjects',
	description: 'Get a list of many objects',
	action: 'Get many objects',
};

/**
 * Default maximum number of objects to fetch in a single API request.
 * @internal
 */
const BATCHSIZE = 1000;

/**
 * Order used when the user gives none.
 * @internal
 */
const DEFAULT_ORDER_BY: Record<string, 'ASC' | 'DESC'>[] = [{ _id: 'ASC' }];

/**
 * Largest batch size a workflow author may set.
 * @internal
 */
const MAX_BATCHSIZE = 50000;

/**
 * Structure of the response format when querying Lime CRM objects.
 *
 * @remarks
 * This is used to define which properties are included in the API response.
 * The keys of the `object` correspond to property names of the entity,
 * and the values are initialized as empty strings.
 *
 * @example
 * {
 *   object: {
 *     _id: '',
 *     name: '',
 *     phone: ''
 *   }
 * }
 *
 * @internal
 */
interface ResponseFormat {
	object: {
		[key: string]: string;
	};
}

/**
 * Defines a collection of properties to order query results by.
 *
 * @remarks
 * Each entry specifies a property name and the direction in which the results
 * should be sorted. Multiple fields can be provided to perform multi-level sorting.
 *
 * @example
 * {
 *   orderByFields: [
 *     { propertyName: 'name', sortDirection: 'ASC' },
 *     { propertyName: 'createdAt', sortDirection: 'DESC' }
 *   ]
 * }
 *
 * @internal
 */
interface OrderByCollection {
	orderByFields: {
		propertyName: string;
		sortDirection: 'ASC' | 'DESC';
	}[];
}

/**
 * Node properties for the "Get Many Objects" operation.
 *
 * @param {string} limetype - The type of entity to query. Loaded from available Limetypes
 * @param {'fields' | 'json'} responseFormatInputMethod - How to format the response
 * @param {Array<{ name: string }>} responseFormatProperties - The properties to include if using 'fields'
 * @param {string} responseFormatJson - JSON defining the response structure if using 'json'
 * @param {string} filter - JSON defining filtering conditions
 * @param {number} limit - Maximum number of objects to return
 * @param {'fields' | 'json'} orderByInputMethod - How to specify ordering
 * @param {OrderByCollection} orderByProperties - Order by fields if using 'fields'
 * @param {string} orderByJson - JSON defining ordering if using 'json'
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
		description: 'The type of entity to query',
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
				operation: ['getManyObjects'],
			},
		},
	},
	{
		displayName: 'Response Format',
		name: 'responseFormatInputMethod',
		type: 'options',
		required: true,
		default: 'fields',
		description: 'Select how the response should be formatted',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
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
	},
	{
		displayName: 'Response Format (Form)',
		name: 'responseFormatProperties',
		type: 'fixedCollection',
		placeholder: 'Add Property',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
				responseFormatInputMethod: ['fields'],
			},
		},
		options: [
			{
				displayName: 'Property Name',
				name: 'property',
				values: [
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
						displayName: 'Property Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							sortable: true,
							loadOptionsMethod: 'getNoHasManyProperties',
							loadOptionsDependsOn: ['limetype.value'],
						},
						default: '',
						// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
						description: 'Name of the property',
					},
				],
			},
		],
	},
	{
		displayName: 'Response Format (JSON)',
		name: 'responseFormatJson',
		type: 'json',
		required: true,
		default: '{\n\t"object": {\n\t\t"_id": ""\n\t}\n}',
		description: 'Information included in the response when using JSON format',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
				responseFormatInputMethod: ['json'],
			},
		},
	},
	{
		displayName: 'Filter (JSON)',
		name: 'filter',
		type: 'json',
		default: '{}',
		description: "The filter DSL defining the query's conditions",
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
	},
	/* eslint-disable n8n-nodes-base/node-param-default-wrong-for-limit, n8n-nodes-base/node-param-type-options-missing-from-limit, n8n-nodes-base/node-param-description-missing-from-limit */
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: DEFAULT_API_OBJECT_LIMIT,
		description:
			'The maximum number of objects to return. Leaving an empty input or specifying "0" will return ' +
			'all objects.',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
	},
	/* eslint-enable n8n-nodes-base/node-param-default-wrong-for-limit, n8n-nodes-base/node-param-type-options-missing-from-limit, n8n-nodes-base/node-param-description-missing-from-limit */
	{
		displayName: 'Offset',
		name: 'offset',
		type: 'number',
		default: '',
		typeOptions: {
			minValue: 0,
		},
		placeholder: 'e.g. 200',
		description:
			'Use together with Limit to manually control pagination when fetching data in batches. This is useful when the number of records exceeds tens of thousands and you want to keep each workflow iteration lightweight. Leave empty to fetch all objects at once, using automatic pagination under the hood.',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
	},
	{
		displayName: 'Order By',
		name: 'orderByInputMethod',
		type: 'options',
		required: true,
		default: 'fields',
		description: 'Select how the response should be ordered',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
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
	},
	{
		displayName: 'Order By (Form)',
		name: 'orderByProperties',
		type: 'fixedCollection',
		placeholder: 'Add Property',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: 'The list of properties by which to order the query results',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
				orderByInputMethod: ['fields'],
			},
		},
		options: [
			{
				name: 'orderByFields',
				displayName: 'Order By Fields',
				values: [
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
						displayName: 'Property Name',
						name: 'propertyName',
						type: 'options',
						required: true,
						typeOptions: {
							sortable: true,
							loadOptionsMethod: 'getNoHasManyProperties',
							loadOptionsDependsOn: ['limetype.value'],
						},
						default: '',
						// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
						description: 'Name of the property to order by',
					},
					{
						displayName: 'Sort Direction',
						name: 'sortDirection',
						type: 'options',
						default: 'ASC',
						description: 'Ordering direction',
						options: [
							{ name: 'Ascending', value: 'ASC' },
							{ name: 'Descending', value: 'DESC' },
						],
					},
				],
			},
		],
	},
	{
		displayName: 'Order By (JSON)',
		name: 'orderByJson',
		type: 'json',
		required: true,
		default: '[\n\t{\n\t\t"_id": "ASC"\n\t}\n]',
		description: 'Provide ordering in JSON',
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
				orderByInputMethod: ['json'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: [DATA_RESOURCE],
				operation: ['getManyObjects'],
			},
		},
		options: [
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				default: BATCHSIZE,
				typeOptions: {
					minValue: 1,
					maxValue: MAX_BATCHSIZE,
				},
				description: `This node splits the fetching into several requests to help avoid timeouts. This sets the maximum number of objects to fetch in a single request to Lime CRM, at most ${MAX_BATCHSIZE}. Every request re-runs the whole query, so a larger batch size makes large result sets faster to fetch, but each request becomes heavier for the Lime CRM server and more likely to time out. The more data you fetch per object, the heavier each request is.`,
			},
		],
	},
];

/**
 * The value of a number parameter: a number, or empty when it is not set.
 * @internal
 */
type NumberParameterValue = number | '' | null | undefined;

/**
 * Return the value of a number parameter, or a default when it is empty.
 *
 * @param value - The parameter value
 * @param fallback - The value to use when the parameter is empty
 * @returns The parameter value, or `fallback` when it is empty
 *
 * @internal
 */
function numberOrDefault(value: NumberParameterValue, fallback: number): number {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}
	return value;
}

/**
 * Rules for validating an integer parameter with {@link validateIntegerParameter}.
 *
 * @property label - The parameter's display name, used in the error message
 * @property min - The smallest allowed value
 * @property max - The largest allowed value, if any
 *
 * @internal
 */
interface IntegerParameterRules {
	label: string;
	min: number;
	max?: number;
}

/**
 * Check that a number parameter is an integer in the allowed range.
 *
 * @remarks
 * The editor only checks values typed into the field, so a value from an expression can
 * still be a decimal or out of range. Such values stop the node with a clear error instead
 * of being sent to the Query API.
 *
 * @param node - The node that reads the parameter, used in the error
 * @param itemIndex - The index of the current item in the workflow execution
 * @param value - The parameter value
 * @param rules - The allowed range and the name to use in the error
 * @throws NodeOperationError if the value is not an integer in the allowed range
 *
 * @internal
 */
function validateIntegerParameter(
	node: INode,
	itemIndex: number,
	value: number,
	rules: IntegerParameterRules,
): void {
	const tooSmall = value < rules.min;
	const tooLarge = rules.max !== undefined && value > rules.max;
	if (!Number.isInteger(value) || tooSmall || tooLarge) {
		const range =
			rules.max === undefined ? `of ${rules.min} or more` : `between ${rules.min} and ${rules.max}`;
		throw new NodeOperationError(
			node,
			`${rules.label} must be a whole number ${range}, got "${String(value)}"`,
			{ itemIndex },
		);
	}
}

/**
 * Create the response format object when using 'fields' mode.
 *
 * @remarks
 * This function takes an array of property descriptors (each with a `name` field)
 * and constructs a response object suitable for Lime CRM queries. It initializes
 * each property with an empty string, ensuring that all requested fields are
 * included in the response, even if the values are not yet set.
 *
 * Additionally, it always includes a default `_id` field in the response object,
 * which is typically required by Lime CRM for object identification.
 *
 * Example:
 * ```ts
 * createResponseFormatObject([{ name: 'name' }, { name: 'email' }]);
 * // Returns: { object: { _id: '', name: '', email: '' } }
 * ```
 *
 * @param properties - Array of property descriptors.
 * @returns The ResponseFormat object.
 *
 * @internal
 */
function createResponseFormatObject(properties: { name: string }[] = []): ResponseFormat {
	const object: Record<string, string> = { _id: '' };
	for (const { name } of properties) {
		if (name) object[name] = '';
	}
	return { object };
}

/**
 * Generate the ordering array for Lime CRM queries.
 *
 * @remarks
 * This function transforms a user-provided `OrderByCollection` object into the
 * format required by the Lime CRM API. Each property in `orderByFields` is
 * converted into a key-value pair where the key is the property name and the
 * value is the sort direction ('ASC' or 'DESC').
 *
 * If no `orderByFields` are provided, it defaults to ordering by `_id` ascending.
 *
 * Example:
 * ```ts
 * getOrderBy({
 *   orderByFields: [
 *     { propertyName: 'name', sortDirection: 'ASC' },
 *     { propertyName: 'createdAt', sortDirection: 'DESC' },
 *   ]
 * });
 * // Returns: [{ name: 'ASC' }, { createdAt: 'DESC' }]
 * ```
 *
 * @param orderByCollection - Collection of order-by fields provided by the user.
 * @returns An array of objects representing the order-by configuration for Lime CRM.
 *
 * @internal
 */
function getOrderBy(orderByCollection: OrderByCollection) {
	const orderBy =
		orderByCollection.orderByFields &&
		orderByCollection.orderByFields.map((field) => ({
			[field.propertyName]: field.sortDirection,
		}));
	return orderBy || DEFAULT_ORDER_BY;
}

/**
 * Fetch Lime CRM objects in batches to handle large result sets or unlimited queries.
 *
 * @remarks
 * This function retrieves objects from Lime CRM for a given limetype by performing
 * multiple sequential API calls, each fetching up to `batchSize` records.
 *
 * @param limetype - The type of Lime CRM entity to fetch
 * @param responseFormat - The format in which objects should be returned, defining which properties are included
 * @param filter - JSON string representing the filter conditions for the query
 * @param limit - Maximum number of objects to fetch in this request
 * @param orderBy - Array of objects defining the sorting of the results
 * @param offset - Starting offset for fetching. Defaults to 0, which preserves automatic pagination from the beginning.
 * @param batchSize - Maximum number of objects to fetch in a single API request.
 *
 * @returns Array of fetched objects or an error response as an array.
 */
async function fetchLimeObjects(
	this: IExecuteFunctions,
	limetype: string,
	responseFormat: ResponseFormat,
	filter: string,
	limit: number | null,
	orderBy: Record<string, 'ASC' | 'DESC'>[],
	offset = 0,
	batchSize = BATCHSIZE,
): Promise<WorkflowResponse<IncludedProperties[]>> {
	const pages: IncludedProperties[][] = [];
	const parsedFilter = JSON.parse(filter);
	const unlimited = limit === null || limit === 0;
	const targetLimit = unlimited ? Infinity : limit;

	let fetched = 0;
	let currentOffset = offset;

	while (fetched < targetLimit) {
		const currentLimit =
			targetLimit === Infinity ? batchSize : Math.min(batchSize, targetLimit - fetched);

		const q = JSON.stringify({
			limetype,
			responseFormat: responseFormat,
			filter: parsedFilter,
			limit: currentLimit,
			offset: currentOffset,
			orderBy: orderBy,
		});

		const batchResponse = await queryLimeobjects(this, q);
		if (!batchResponse.success) return batchResponse.data;

		const batch = batchResponse.data;

		const collected = batch.objects.length;
		if (collected === 0) break;

		pages.push(batch.objects);

		fetched += collected;
		currentOffset += collected;

		if (collected < currentLimit) break;
	}

	return pages.flat();
}

/**
 * Execute the "Get Many Objects" operation for Lime CRM.
 *
 * @remarks
 * Retrieves multiple Lime CRM objects of the selected limetype with optional filtering, ordering, and response formatting.
 * The method supports batch fetching if the requested limit exceeds 50 records.
 *
 * Steps performed by the method:
 * 1. Determine the limetype and response format (fields or JSON) from {@link properties}.
 * 2. Determine ordering (fields or JSON) from {@link properties}.
 * 3. Fetch data from Lime CRM, handling batching if necessary.
 *
 * @param i - The index of the current item in the workflow execution
 *
 * @returns The fetched Lime objects as per the requested response format.
 *
 * @public
 */
export async function execute(this: IExecuteFunctions, i: number) {
	const limetype = this.getNodeParameter('limetype', i, undefined, {
		extractValue: true,
	}) as string;
	const responseFormatInputMethod = this.getNodeParameter('responseFormatInputMethod', i) as string;
	const orderByInputMethod = this.getNodeParameter('orderByInputMethod', i) as string;
	const filter = this.getNodeParameter('filter', i) as string;
	const options = this.getNodeParameter('options', i, {}) as { batchSize: NumberParameterValue };
	const limit = numberOrDefault(
		this.getNodeParameter('limit', i, DEFAULT_API_OBJECT_LIMIT) as NumberParameterValue,
		0,
	);
	const offset = numberOrDefault(this.getNodeParameter('offset', i, 0) as NumberParameterValue, 0);
	const batchSize = numberOrDefault(options.batchSize, BATCHSIZE);

	const node = this.getNode();
	validateIntegerParameter(node, i, limit, {
		label: 'Limit',
		min: 0,
	});
	validateIntegerParameter(node, i, offset, {
		label: 'Offset',
		min: 0,
	});
	validateIntegerParameter(node, i, batchSize, {
		label: 'Batch Size',
		min: 1,
		max: MAX_BATCHSIZE,
	});

	let response;
	if (responseFormatInputMethod === 'fields') {
		const properties = this.getNodeParameter('responseFormatProperties', i) as {
			property: [{ name: string }];
		};
		response = createResponseFormatObject(properties.property);
	} else if (responseFormatInputMethod === 'json') {
		response = this.getNodeParameter('responseFormatJson', i) as string;
		response = JSON.parse(response);
	}

	let orderBy;
	if (orderByInputMethod === 'fields') {
		const orderByCollection = this.getNodeParameter('orderByProperties', i) as OrderByCollection;
		orderBy = getOrderBy(orderByCollection);
	} else if (orderByInputMethod === 'json') {
		orderBy = this.getNodeParameter('orderByJson', i) as string;
		orderBy = JSON.parse(orderBy);
	}

	// Lime CRM rejects an offset without an order, so paging needs one.
	if (Array.isArray(orderBy) && orderBy.length === 0) {
		orderBy = DEFAULT_ORDER_BY;
	}

	return await fetchLimeObjects.call(
		this,
		limetype,
		response,
		filter,
		limit,
		orderBy,
		offset,
		batchSize,
	);
}
