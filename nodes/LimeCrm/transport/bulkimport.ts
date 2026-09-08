import { randomUUID } from 'node:crypto';
import { IExecuteFunctions, LoggerProxy as Logger, NodeApiError } from 'n8n-workflow';
import { callLimeApi } from './commons';

/**
 * Endpoint path for Lime CRM bulk import API.
 *
 * @internal
 * @group Transport
 */
const BULK_IMPORT_URL = '/limepkg-mbeku-bulk-import/bulk-imports/';

/**
 * Response from creating a bulk import job.
 *
 * @property id - The unique ID of the bulk import job
 * @property createdBy - The ID of the user who created the job
 * @property fileId - The ID of the uploaded file (if any)
 * @property status - The current status of the job (`waiting_for_data`, `ready`, `failed`, `succeeded`)
 * @property startedAt - Timestamp when the job started (if any)
 * @property endedAt - Timestamp when the job ended (if any)
 * @property metadata - Metadata about the job configuration
 * @property metadata.limetype - The Lime type being imported
 * @property metadata.properties - Array of property names being imported
 * @property metadata.mode - Import mode
 * @property metadata.matchingProperty - Property used for matching existing records
 * @property result - Summary of the job results (if finished)
 * @property result.total - Total number of records processed
 * @property result.created - Number of records created
 * @property result.updated - Number of records updated
 * @property result.skipped - Number of records skipped
 * @property result.failed - Number of records failed
 * @property extras - Optional extra metadata from the server/job runner
 * @property extras.task_id - Optional background task id (snake_case)
 * @property extras.taskId - Optional background task id (camelCase)
 *
 * @public
 * @group Transport
 */
export interface BulkImportJobResponse {
	id: string;
	createdBy: number;
	fileId: number | null;
	status: 'waiting_for_data' | 'ready' | 'failed' | 'succeeded';
	startedAt: string | null;
	endedAt: string | null;
	metadata: {
		limetype: string;
		properties: string[];
		mode: BulkImportMode;
		matchingProperty: string;
	};
	result: null | {
		total: number;
		created: number;
		updated: number;
		skipped: number;
		failed: number;
	};
	extras: null | {
		task_id?: string;
		taskId?: string;
	};
}

/**
 * The mode for a bulk import operation.
 *
 * @public
 * @group Transport
 */
export type BulkImportMode = 'create' | 'update' | 'create_or_update';

/**
 * Payload for creating a bulk import job.
 *
 * @property limetype - The Limetype to import objects into
 * @property properties - List of property names to import
 * @property mode - The import mode
 * @property matchingProperty - Property to use for matching existing records (required for 'update' and 'create_or_update' modes)
 *
 * @public
 * @group Transport
 */
export interface BulkImportJobPayload {
	limetype: string;
	properties: string[];
	mode: BulkImportMode;
	matchingProperty?: string;
}

/**
 * Object representing a single object to import.
 *
 * @property values - Key-value pairs of property names and their values
 * @property extras - (Optional) Additional informational data for the import
 *
 * @public
 * @group Transport
 */
export interface BulkImportPayloadObject {
	values: Record<string, unknown>;
	extras?: Record<string, unknown>;
}

/**
 * Create a new bulk import job in Lime CRM.
 *
 * @param context - The n8n execution context
 * @param payload - The bulk import job configuration
 *
 * @returns Promise resolving to the created job response with id and status
 *
 * @public
 * @group Transport
 */
export async function createBulkImportJob(
	context: IExecuteFunctions,
	payload: BulkImportJobPayload,
): Promise<BulkImportJobResponse> {
	Logger.info(
		`Creating bulk import job at ${BULK_IMPORT_URL} with payload: ${JSON.stringify(payload)}`,
	);
	try {
		const response = await callLimeApi<BulkImportJobResponse>(context, {
			method: 'POST',
			url: BULK_IMPORT_URL,
			requestOptions: {
				body: payload,
			},
		});
		if (!response.success) {
			throw new NodeApiError(context.getNode(), {
				message: 'The bulk import job was rejected by the server.',
				description: `${JSON.stringify(response.data)}`,
			});
		}
		Logger.info(
			`Created bulk import job at ${BULK_IMPORT_URL} with payload: ${JSON.stringify(payload)}`,
		);

		return response.data;
	} catch (error) {
		Logger.error(
			`Failed to create bulk import job at ${BULK_IMPORT_URL} with payload: ${JSON.stringify(payload)}`,
		);
		throw error;
	}
}

/**
 * Build a multipart/form-data body with the import payload as a single
 * `file` part.
 *
 * Assembled manually because `httpRequestWithAuthentication` has no
 * `formData` option and the package must stay free of runtime dependencies
 * to remain eligible for n8n community node verification.
 *
 * @param jsonData - The serialized import payload
 * @param boundary - The multipart boundary (must match the Content-Type header)
 *
 * @returns The multipart body as a Buffer
 *
 * @internal
 * @group Transport
 */
function buildMultipartFileBody(jsonData: string, boundary: string): Buffer {
	return Buffer.concat([
		Buffer.from(
			`--${boundary}\r\n` +
				'Content-Disposition: form-data; name="file"; filename="import-data.json"\r\n' +
				'Content-Type: application/json\r\n\r\n',
			'utf8',
		),
		Buffer.from(jsonData, 'utf8'),
		Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
	]);
}

/**
 * Upload data to an existing bulk import job.
 *
 * @param context - The n8n execution context
 * @param jobId - The ID of the bulk import job
 * @param data - Array of objects to import
 *
 * @returns Promise resolving when upload is complete
 *
 * @public
 * @group Transport
 */
export async function uploadBulkImportData(
	context: IExecuteFunctions,
	jobId: string,
	data: unknown,
): Promise<void> {
	const url = `${BULK_IMPORT_URL}${jobId}`;

	const message = `Uploading data to: ${url} for job ID: ${jobId}`;
	Logger.info(message);

	const jsonData = JSON.stringify(data);
	const boundary = `----LimeCrmBulkImport${randomUUID()}`;

	const response = await callLimeApi(context, {
		method: 'POST',
		url: url,
		json: false,
		requestOptions: {
			body: buildMultipartFileBody(jsonData, boundary),
			headers: {
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
		},
	});
	if (!response.success) {
		throw new NodeApiError(context.getNode(), {
			message: 'The bulk import data upload was rejected by the server.',
			description: `${JSON.stringify(response)}`,
		});
	}

	Logger.info(`Successfully uploaded data for job ID: ${jobId}`);
}

/**
 * Get the status of a bulk import job.
 *
 * @param context - The n8n execution context
 * @param jobId - The ID of the bulk import job
 *
 * @returns Promise resolving to the job status response
 *
 * @public
 * @group Transport
 */
export async function getBulkImportJobStatus(
	context: IExecuteFunctions,
	jobId: string,
): Promise<BulkImportJobResponse> {
	Logger.info(`Fetching status for bulk import job ID: ${jobId}`);
	const response = await callLimeApi<BulkImportJobResponse>(context, {
		method: 'GET',
		url: `${BULK_IMPORT_URL}${jobId}`,
	});

	if (!response.success) {
		throw new NodeApiError(context.getNode(), {
			message: 'The bulk import job status could not be retrieved.',
			description: `${JSON.stringify(response)}`,
		});
	}

	return response.data;
}

/**
 * Poll a bulk import job until it completes.
 *
 * @param context - The n8n execution context
 * @param jobId - The ID of the bulk import job
 * @param pollIntervalMs - Milliseconds to wait between polls (default: 2500)
 *
 * @returns Promise resolving to the final job status response
 *
 * @public
 * @group Transport
 */
export async function waitForBulkImportJob(
	context: IExecuteFunctions,
	jobId: string,
	pollIntervalMs: number = 2500,
): Promise<BulkImportJobResponse> {
	let status = 'running';
	let response: BulkImportJobResponse;

	while (['waiting_for_data', 'ready', 'running'].includes(status)) {
		// Wait before polling
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

		Logger.info(`Polling bulk import job ID: ${jobId}`);
		response = await getBulkImportJobStatus(context, jobId);
		status = response.status;
	}

	return response!;
}
