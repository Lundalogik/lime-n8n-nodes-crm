// The mock handle is only meaningful if the importing spec calls
// `jest.mock('.../transport', ...)` at the top of the file — Jest hoists
// those mocks above all imports, so this file picks up the mocked
// version automatically.

import {
    IBinaryData,
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
} from 'n8n-workflow';

import * as transport from '../../../nodes/lime-crm/transport';

// Faithful port of n8n-core's returnJsonArray (n8n-core is not a dev
// dependency, so the real runtime helper is unavailable in tests): items
// that already carry a `json` key pass through unchanged (keeping binary,
// error, etc.), bare objects get wrapped as { json: object }.
function returnJsonArray(
    jsonData: IDataObject | IDataObject[]
): INodeExecutionData[] {
    const items = Array.isArray(jsonData) ? jsonData : [jsonData];
    return items.map((data) =>
        data?.json
            ? ({ ...data, json: data.json } as INodeExecutionData)
            : { json: data }
    );
}

// Context for driving the whole node's execute()
export function makeNodeExecuteContext(
    params: Record<string, unknown>,
    overrides?: {
        continueOnFail?: boolean;
        onError?: string;
        inputItems?: INodeExecutionData[];
        binaryData?: IBinaryData;
    }
): IExecuteFunctions {
    return {
        getInputData: jest.fn(() => overrides?.inputItems ?? [{ json: {} }]),
        getNodeParameter: jest.fn(
            (name: string, i: number, defaultValue?: unknown) => {
                const value = name in params ? params[name] : defaultValue;
                return typeof value === 'function' ? value(i) : value;
            }
        ),
        continueOnFail: jest.fn(() => overrides?.continueOnFail ?? false),
        getNode: jest.fn(() => ({
            name: 'Test',
            id: 't',
            onError: overrides?.onError ?? 'stopWorkflow',
        })),
        getCredentials: jest
            .fn()
            .mockResolvedValue({ url: 'https://lime.example.com' }),
        helpers: {
            returnJsonArray: jest.fn(returnJsonArray),
            assertBinaryData: jest.fn(() => {
                if (!overrides?.binaryData) {
                    throw new Error('no binary data in test context');
                }
                return overrides.binaryData;
            }),
            getBinaryDataBuffer: jest.fn(),
            // Minimal stand-in for n8n's binary data helper: wraps a buffer
            // without a fileName, so setFilename falls back to the
            // response-derived name.
            prepareBinaryData: jest.fn(async (buffer: Buffer) => ({
                data: buffer.toString('base64'),
                mimeType: 'application/octet-stream',
                fileExtension: 'bin',
            })),
        },
    } as unknown as IExecuteFunctions;
}

// ── Mock transport handles ───────────────────────────────────────────────────

// The lime-crm transport barrel (nodes/lime-crm/transport). Use
// `transportMock.<fn>.mockResolvedValue(...)` from your spec.
export const transportMock = transport as jest.Mocked<typeof transport>;
