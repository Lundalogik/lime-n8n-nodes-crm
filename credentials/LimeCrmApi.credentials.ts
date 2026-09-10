import { ICredentialType, INodeProperties, IAuthenticate } from 'n8n-workflow';

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
 * The credential is tested by the `limeCrmApiTest` function (see `nodes/credentialTests.ts`),
 * which validates the optional webhook secret locally and verifies the URL and API key
 * by sending a `GET` request to the `/api/v1/` endpoint of the provided Lime CRM instance.
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
		{
			displayName: 'Webhook Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description:
				'Secret used to sign and verify webhook calls from Lime CRM. ' +
				'Required only when using the Lime CRM Trigger node. ' +
				'Use a strong random value of at least 32 characters, e.g. ' +
				'generated with <code>openssl rand -hex 32</code>. Workflows ' +
				'with a Lime CRM Trigger must be re-activated after ' +
				'changing it.',
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
}
