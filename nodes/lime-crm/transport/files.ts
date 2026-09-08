import { IExecuteFunctions, IBinaryData, BINARY_ENCODING } from 'n8n-workflow';
import { callLimeApi, prepareResponseWithoutKeys } from './commons';
import { getLimeobject } from './limeobjects';
import {
    getFilenameFromHeader,
    handleWorkflowError,
    setFilename,
} from '../utils';
import { APIResponse } from '../../response';
/**
 * Endpoint path for Lime CRM file API.
 *
 * @internal
 * @group Transport
 */
const LIME_FILE_URL = '/api/v1/file/';

/**
 * Response from Lime file API containing HTTP headers and raw file body.
 *
 * @property headers - HTTP headers returned by the API
 * @property body - Raw file body as a Buffer
 *
 * @public
 * @group Transport
 */
export interface FileApiResponse {
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
}

/**
 * Metadata about a file stored in Lime CRM.
 *
 * @property filename - Name of the file
 * @property id - File ID in Lime CRM
 * @property size - File size in bytes
 * @property content_type - MIME type of the file
 * @property extension - File extension
 * @property created_by - ID of the user who created the file
 * @property locked_by - ID of the user who locked the file
 * @property last_modified - Last modified timestamp
 * @property _links - Optional links returned by Lime API
 *
 * @public
 * @group Transport
 */
export type FileMetadata = {
    filename: string;
    id: number;
    size: number;
    content_type: string;
    extension: string;
    created_by: number;
    locked_by: number;
    last_modified: string;
    _links?: { [key: string]: { href: string } };
};

/**
 * Retrieve metadata for a file by its ID.
 *
 * @param nodeContext - n8n execution context
 * @param id - The ID of the file
 * @returns File metadata
 *
 * @public
 * @group Transport
 */
export async function getFileMetadata(
    nodeContext: IExecuteFunctions,
    id: string | number
): Promise<APIResponse<FileMetadata>> {
    const url = `${LIME_FILE_URL}${id}/`;
    const fileMetadataResponse = await callLimeApi<FileMetadata>(nodeContext, {
        method: 'GET',
        url: url,
    });

    if (!fileMetadataResponse.success) return fileMetadataResponse;

    return prepareResponseWithoutKeys(fileMetadataResponse, ['_links']);
}

/**
 * Retrieve file metadata for a specific property of a Lime object.
 *
 * @param nodeContext - n8n execution context
 * @param limetype - Name of the Limetype
 * @param id - The Lime object ID
 * @param fileTypeProperty - The property name holding the file reference
 * @returns File metadata
 *
 * @public
 * @group Transport
 */
export async function getFileMetadataByLimeobject(
    nodeContext: IExecuteFunctions,
    limetype: string,
    id: string,
    fileTypeProperty: string
): Promise<APIResponse<FileMetadata>> {
    const objectResponse = await getLimeobject(nodeContext, limetype, id);
    if (!objectResponse.success) return objectResponse;

    const fileId = objectResponse.data[fileTypeProperty] as
        | string
        | number
        | null
        | undefined;

    if (fileId === undefined || fileId === null || fileId === '') {
        return handleWorkflowError(
            nodeContext.getNode(),
            {
                message:
                    'The specified Limeobject does not have an associated file',
            },
            true
        );
    }

    return await getFileMetadata(nodeContext, fileId);
}

/**
 * Download file content by file ID and prepare binary data for n8n nodes.
 *
 * @param nodeContext - n8n execution context
 * @param id - The ID of the file
 * @returns prepared binary data
 *
 * @public
 * @group Transport
 */
export async function getFileContent(
    nodeContext: IExecuteFunctions,
    id: string | number
): Promise<APIResponse<IBinaryData>> {
    const url = `${LIME_FILE_URL}${id}/contents/`;

    const response = await callLimeApi<FileApiResponse>(nodeContext, {
        method: 'GET',
        url: url,
        requestOptions: {
            encoding: 'stream',
            returnFullResponse: true,
        },
        json: false,
    });

    if (!response.success) return response;

    const fileName =
        getFilenameFromHeader(response.data.headers) || `file_${id}`;
    const binaryData = await nodeContext.helpers.prepareBinaryData(
        response.data.body
    );
    binaryData.fileName = setFilename(binaryData, fileName);

    return {
        success: true,
        data: binaryData,
    };
}

/**
 * Download file content for a specific property of a Lime object.
 *
 * @param nodeContext - n8n execution context
 * @param limetype - Name of the Limetype
 * @param id - The Lime object ID
 * @param fileTypeProperty - The property name holding the file reference
 * @returns Prepared binary data
 *
 * @public
 * @group Transport
 */
export async function getFileContentByLimetype(
    nodeContext: IExecuteFunctions,
    limetype: string,
    id: string,
    fileTypeProperty: string
): Promise<APIResponse<IBinaryData>> {
    const limeObjectResponse = await getLimeobject(nodeContext, limetype, id);
    if (!limeObjectResponse.success) return limeObjectResponse;

    const fileId = limeObjectResponse.data[fileTypeProperty] as
        | string
        | number
        | null
        | undefined;

    if (fileId === undefined || fileId === null || fileId === '') {
        return handleWorkflowError(
            nodeContext.getNode(),
            {
                message:
                    'The specified Limeobject does not have an associated file.',
            },
            true
        );
    }

    return await getFileContent(nodeContext, fileId);
}

/**
 * Create a file in Lime CRM using binary data.
 *
 * @param nodeContext - n8n execution context
 * @param binary - The binary data to upload
 * @param fallbackFileName - File name to use if `binary.fileName` is missing
 * @returns Created file metadata
 *
 * @public
 * @group Transport
 */
export async function createFile(
    nodeContext: IExecuteFunctions,
    binary: IBinaryData,
    fallbackFileName: string
): Promise<APIResponse<FileMetadata>> {
    const response = await callLimeApi<FileMetadata>(nodeContext, {
        method: 'POST',
        url: LIME_FILE_URL,
        requestOptions: {
            body: Buffer.from(binary.data, BINARY_ENCODING),
            headers: {
                'Content-Disposition': `;filename*="UTF-8''${encodeURIComponent(binary.fileName || fallbackFileName)}"`,
                'Content-Type': binary.mimeType,
            },
        },
    });
    if (!response.success) return response;

    return prepareResponseWithoutKeys(response, ['_links']);
}
