import {
    ICredentialType,
    INodeProperties,
    IHttpRequestMethods,
    IAuthenticate,
    ICredentialTestRequest,
} from 'n8n-workflow';

import { LIME_CRM_API_CREDENTIAL_KEY } from '../nodes';

/**
 * LimeCrmApi Credential
 * ---------------------
 * This credential type allows n8n nodes to authenticate and interact with the Lime CRM API.
 *
 * ## Authentication
 * The Lime CRM API uses a custom header (`X-API-Key`) for authentication. Once configured,
 * n8n automatically injects the API key into all HTTP requests made using this credential.
 *
 * **Header used:**
 * ```
 * X-API-Key: <your-api-key>
 * ```
 *
 * ## Required Fields
 * - **Server URL:** The base URL of your Lime CRM instance.
 *   - Example: `https://instance.lime-crm.com/instance-name`
 *
 * - **API Key:** The API key generated in Lime CRM.
 *   - You can obtain it from Lime Admin.
 *
 * ## Testing Connection
 * The `test` property verifies credentials by sending a `GET` request to the `/api/v1/` endpoint
 * of the provided Lime CRM instance. If the response is successful (HTTP 200), the credentials
 * are valid.
 *
 * ## Related Documentation
 * - Lime CRM API Docs: https://lime-crm.com/api-docs/
 * - n8n Credentials Guide: https://docs.n8n.io/integrations/credentials/
 *
 * @public
 */
export class LimeCrmApi implements ICredentialType {
    name = LIME_CRM_API_CREDENTIAL_KEY;
    displayName = 'Lime CRM API';
    documentationUrl = 'https://lime-crm.com/api-docs/';
    icon = 'file:assets/lime-crm.svg' as const;
    properties: INodeProperties[] = [
        {
            displayName: 'Server URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://instance.lime-crm.com/instance-name',
            required: true,
            description: 'The URL of your Lime CRM instance',
        },
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            required: true,
            description: 'The API key obtained from Lime CRM',
        },
    ];

    authenticate: IAuthenticate = {
        type: 'generic',
        properties: {
            headers: {
                // Ensure the header name matches exactly what the Lime CRM API expects
                'X-API-Key': '={{$credentials.apiKey}}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.url}}'.replace('/+$', ''),
            url: '/api/v1/',
            method: 'GET' as IHttpRequestMethods,
            headers: {
                'X-API-Key': '={{$credentials.apiKey}}',
                Accept: 'application/json',
            },
        },
    };
}
