import { IBinaryData, IDataObject, IExecuteFunctions, LoggerProxy as Logger } from 'n8n-workflow';
import { createFile, getFileContent, getFileMetadata } from '../transport';
import { APIResponse, FileAPIResponse } from '../../response';
import { LimetypeProperty } from '../models';

/**
 * Set a default file name if missing.
 *
 * @param preparedBinaryData - The binary data object
 * @param responseFileName -The fallback file name to assign if the binary data has no name
 *
 * @returns Set filename
 * @public
 * @group Utils
 */
export const setFilename = (preparedBinaryData: IBinaryData, responseFileName: string) => {
	if (!preparedBinaryData.fileName && preparedBinaryData.fileExtension) {
		return responseFileName;
	}

	return preparedBinaryData.fileName;
};

/**
 * Extract a filename from the `Content-Disposition` HTTP header.
 *
 * @param headers - An object containing HTTP headers, where the key may be either
 * `'content-disposition'` or `'Content-Disposition'`
 *
 * @returns Filename or `null` if the header does not contain one
 * @public
 * @group Utils
 */
export function getFilenameFromHeader(
	headers: Record<string, string | string[] | undefined>,
): string | null {
	let contentDisposition = headers['content-disposition'] || headers['Content-Disposition'];
	if (!contentDisposition) return null;

	if (Array.isArray(contentDisposition)) {
		contentDisposition = contentDisposition[0];
	}

	// Try RFC 5987 filename* format
	const filenameStarMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition);
	if (filenameStarMatch) {
		try {
			return decodeURIComponent(filenameStarMatch[1]);
		} catch {
			return filenameStarMatch[1];
		}
	}

	// Try regular filename="..." or filename=...
	const filenameMatch = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(contentDisposition);
	if (filenameMatch) {
		return filenameMatch[1] || filenameMatch[2];
	}

	return null;
}

/**
 * Retrieve all file properties names for a given Limetype
 * and optionally filter by a set of allowed property names.
 *
 * @param properties - the {@link LimeTypeProperty} object array fetched from Lime CRM
 * @param allowedProperties - An optional set of property names to include in the result
 *
 * @returns A set containing the names of all matching file-type properties.
 * @public
 * @group Utils
 */
export function getFilePropertiesNames(
	properties: LimetypeProperty[],
	allowedProperties?: Set<string>,
): Set<string> {
	return new Set(
		properties
			.filter(
				(property) =>
					property.type === 'file' && (!allowedProperties || allowedProperties.has(property.name)),
			)
			.map((property) => property.name),
	);
}

/**
 * Iterate through all file properties, checks whether
 * the corresponding values represent valid binary data, and uploads them.
 * When a file is successfully uploaded, its property value is replaced with the returned file ID.
 *
 * @param context - The n8n node execution context
 * @param i - The index of the current item being processed
 * @param fileProperties - A set of Limeobject property names that are of type `'file'`
 * @param definedProperties - An object containing property values
 *
 * @returns A response object indicating whether the operation succeeded and containing
 * the updated properties.
 *
 * @public
 * @group Utils
 */
export async function setFileProperties(
	context: IExecuteFunctions,
	i: number,
	fileProperties: Set<string>,
	definedProperties: IDataObject,
): Promise<APIResponse<IDataObject>> {
	for (const fileProperty of fileProperties) {
		if (!(fileProperty in definedProperties)) continue;
		let binaryData: IBinaryData;
		try {
			Logger.info(
				`Checking whether "${definedProperties[fileProperty]}" is a valid binary object for property "${fileProperty}"...`,
			);
			binaryData = context.helpers.assertBinaryData(i, definedProperties[fileProperty] as string);
		} catch {
			Logger.info(
				`Invalid or missing binary data for "${fileProperty}". Using original value instead.`,
			);
			continue;
		}

		const response = await createFile(
			context,
			binaryData,
			definedProperties[fileProperty] as string,
		);

		if (response.success) {
			definedProperties[fileProperty] = response.data.id;
		} else return response;
	}
	return {
		success: true,
		data: definedProperties,
	};
}

/**
 * Update file properties with a file metadata and optionally retrieves file content.
 *
 * @param nodeContext - The n8n node execution context
 * @param fileProperties - A set of file property names to process
 * @param data - The record data containing property values to process
 * @param includeFileContent - Whether to include the actual file content in the response. Defaults to `false`
 *
 * @returns A {@link FileAPIResponse} object containing updated JSON data and, if requested, the associated binary files.
 *
 * @public
 * @group Utils
 */
export async function processFileResponse<T extends Record<string, unknown>>(
	nodeContext: IExecuteFunctions,
	fileProperties: Set<string>,
	data: T,
	includeFileContent: boolean = false,
): Promise<FileAPIResponse<T>> {
	let updatedData = { ...data };
	const binaryData: Record<string, IBinaryData> = {};
	for (const fileProperty of fileProperties) {
		if (!data[fileProperty]) continue;
		const fileMetadataResponse = await getFileMetadata(nodeContext, data[fileProperty] as string);
		if (!fileMetadataResponse.success)
			return {
				json: fileMetadataResponse,
			};

		updatedData = {
			...updatedData,
			[fileProperty]: fileMetadataResponse.data,
		};

		if (includeFileContent) {
			const fileContentResponse = await getFileContent(nodeContext, fileMetadataResponse.data.id);
			if (fileContentResponse.success) {
				binaryData[fileProperty] = fileContentResponse.data;
			} else {
				return { json: fileContentResponse };
			}
		}
	}
	return {
		json: {
			success: true,
			data: updatedData,
		},
		binary: binaryData,
	};
}
