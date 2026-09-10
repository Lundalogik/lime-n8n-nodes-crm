import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeOperationError,
	LoggerProxy as Logger,
	NodeConnectionTypes,
	NodeApiError,
} from 'n8n-workflow';

import { LIME_CRM_API_CREDENTIAL_KEY } from './models';
import { getLimetypes } from './methods';
import {
	createSubscription,
	deleteSubscription,
	getSubscription,
	listSubscriptionsWithExistingData,
} from './transport';
import { createHash } from 'node:crypto';

import { getWebhook, handleWorkflowError } from './utils';
import { verifyRequest } from '../crypto';
import { getWebhookSecret } from '../webhookSecret';
import { limeCrmApiTest } from '../credentialTests';

/**
 * Trigger node for handling incoming webhooks from **Lime CRM**.
 *
 * This node subscribes to events in Lime (such as record creation, update, or deletion)
 * and triggers workflows in n8n when those events occur.
 *
 * @remarks
 * - Automatically manages webhook subscriptions in Lime CRM (create, check, delete).
 * - Verifies incoming webhook authenticity using HMAC signatures.
 * - Returns the received payload as JSON to connected nodes.
 *
 * @public
 * @group Node Definition
 *
 * @see {@link getSubscription} - Fetches an existing webhook subscription
 * @see {@link listSubscriptionsWithExistingData} - Checks for existing subscriptions matching the same target URL and events
 * @see {@link createSubscription} - Creates a new webhook subscription in Lime
 * @see {@link deleteSubscription} - Removes an existing webhook subscription
 */
export class LimeCrmTrigger implements INodeType {
	/**
	 * Definition of the node’s metadata, input/output configuration,
	 * authentication requirements, and event subscription options.
	 */
	description: INodeTypeDescription = {
		displayName: 'Lime CRM Trigger',
		name: 'limeCrmTrigger',
		documentationUrl:
			'https://platform.docs.lime-crm.com/en/latest/workflows-and-integrations/node-reference/',
		icon: 'file:assets/lime-crm.svg',
		group: ['trigger'],
		subtitle: 'On Lime CRM event',
		version: 1,
		description:
			'Trigger which handles webhooks coming from Lime, e.g when ' + 'an object is updated',
		defaults: {
			name: 'Lime CRM Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: LIME_CRM_API_CREDENTIAL_KEY,
				required: true,
				testedBy: 'limeCrmApiTest',
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					required: true,
				},
				default: {},
				placeholder: 'Add Event',
				description: 'Events to subscribe to',
				options: [
					{
						name: 'event',
						displayName: 'Event',
						values: [
							{
								displayName: 'Limetype Name or ID',
								name: 'limetype',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getLimetypes',
								},
								default: '',
								description:
									'Limetype to subscribe to events for. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
							},
							{
								displayName: 'Event',
								name: 'eventType',
								type: 'options',
								options: [
									{
										name: 'New',
										value: 'new',
										description: 'When a new object is created',
									},
									{
										name: 'Update',
										value: 'update',
										description: 'When an object is updated',
									},
									{
										name: 'Delete',
										value: 'delete',
										description: 'When an object is deleted',
									},
								],
								default: 'new',
								description: 'Event to subscribe to',
							},
						],
					},
				],
			},
		],
	};

	/**
	 * Methods used to dynamically load options in the node UI. For details, see:
	 *
	 * - {@link getLimetypes}
	 */
	methods = {
		loadOptions: {
			getLimetypes,
		},
		credentialTest: {
			limeCrmApiTest,
		},
	};

	/**
	 * Webhook lifecycle management methods:
	 *
	 * - checkExists - Verifies whether the webhook already exists in Lime CRM
	 * - create - Creates a new webhook subscription in Lime CRM if one does not exist
	 * - delete - Deletes the existing webhook subscription in Lime CRM
	 */
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhook = getWebhook(this);

				// Older versions stored an encrypted copy of the secret in
				// static data. The subscription in Lime CRM still signs with
				// that secret, which is no longer readable, so report the
				// webhook as missing to have `create` re-register it with the
				// secret from the credential and clean up the stale one.
				if (webhook.data.webhookSecret) {
					delete webhook.data.webhookSecret;
					return false;
				}

				if (!webhook.data.webhookId) {
					return false;
				}

				try {
					await getSubscription(this, webhook.data.webhookId);
				} catch (error) {
					if (error.cause?.status === 404) {
						delete webhook.data.webhookId;
						delete webhook.data.webhookEvents;
						return false;
					}
					Logger.warn(`There was en error while getting a webhook from Lime CRM: ${error}`);
					throw new NodeApiError(this.getNode(), error);
				}
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhook = getWebhook(this);
				const webhookUrl = webhook.url;
				if (!webhookUrl) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid Webhook URL. Please make sure that it is not localhost!',
					);
				}

				// Check if a webhook already exists in order to not duplicate it in Lime
				// This is a different check then 'checkExists' which only takes an ID,
				// but it's only suited for production environment
				const existingSubscriptionResponse = await listSubscriptionsWithExistingData(this, webhook);
				if (!existingSubscriptionResponse.success) {
					throw new NodeApiError(this.getNode(), {
						message: existingSubscriptionResponse.data.error.message,
					});
				}

				const webhookCreateData = {
					...webhook,
					secret: await getWebhookSecret(this, LIME_CRM_API_CREDENTIAL_KEY),
				};

				const createSubscriptionResponse = await createSubscription(this, webhookCreateData);

				if (!createSubscriptionResponse.success) {
					throw new NodeApiError(this.getNode(), {
						message: createSubscriptionResponse.data.error.message,
					});
				}

				// Delete existing duplicated webhooks if a new one was successfully created
				if (existingSubscriptionResponse.data.length > 0) {
					for (const subscription of existingSubscriptionResponse.data) {
						Logger.info('Deleting existing Lime CRM webhook with ID: ' + subscription.id);
						await deleteSubscription(this, subscription.id);
					}
				}

				const subscriptionId = createSubscriptionResponse.data.id;
				const events = createSubscriptionResponse.data.events;

				webhook.data.webhookId = subscriptionId;
				webhook.data.webhookEvents = events;
				Logger.info(
					`Webhook with URL ${webhook.url}, ID ${subscriptionId} and events ${events} created!`,
				);
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhook = getWebhook(this);
				Logger.info(`Deleting webhook with ID: ${webhook.data.webhookId}`, { ...webhook });
				if (webhook.data.webhookId !== undefined) {
					try {
						await deleteSubscription(this, webhook.data.webhookId);
					} catch {
						Logger.error(`Failed to delete webhook with ID: ${webhook.data.webhookId}`, {
							...webhook,
						});
						return false;
					}
					delete webhook.data.webhookId;
					Logger.info('Webhook deleted successfully', { ...webhook });
					return true;
				}
				return false;
			},
		},
	};

	/**
	 * Main webhook handler — called when Lime CRM sends an event to this node.
	 *
	 * @returns The formatted webhook response data ready for n8n workflow processing.
	 *
	 * @throws NodeOperationError if authentication fails or webhook data is invalid.
	 *
	 * @example
	 * ```ts
	 * // Example webhook body:
	 * {
	 *   "event": "deal.new",
	 *   "body": {
	 *     "id": 1001,
	 *     "limetype": "deal",
	 *     "values": { "company": 1001, "coworker": 1001, "probability": 0, ... }
	 *   }
	 * }
	 * ```
	 */
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhook = getWebhook(this);
		Logger.info('Webhook received. Starting webhook processing...', {
			...webhook.context,
		});
		const webhookSecret = await getWebhookSecret(this, LIME_CRM_API_CREDENTIAL_KEY);
		const requestObject = this.getRequestObject();
		const headerData = this.getHeaderData();
		const bodyData = this.getBodyData();
		const limeSignature = headerData['x-lime-signature'] as string;

		try {
			verifyRequest(this.getNode(), limeSignature, webhookSecret, requestObject.rawBody);
		} catch (error) {
			const secretFingerprint = webhookSecret
				? createHash('sha256').update(webhookSecret).digest('hex').slice(0, 16)
				: '';
			const returnData = handleWorkflowError(this.getNode(), {
				message: error.message,
				receivedSignature: limeSignature,
				bodyLength: requestObject.rawBody.length,
				secretFingerprint,
			});
			return {
				workflowData: [this.helpers.returnJsonArray(returnData.data)],
			};
		}

		if (!bodyData || !bodyData.event || !bodyData.body) {
			Logger.warn('Webhook data is invalid. Missing event or body', {
				...webhook.context,
			});
			throw new NodeOperationError(this.getNode(), 'Webhook data is invalid');
		}

		const returnData: IDataObject[] = [];
		returnData.push({
			body: bodyData,
			headers: headerData,
			query: this.getQueryData(),
		});

		return { workflowData: [this.helpers.returnJsonArray(returnData)] };
	}
}
