import { callLimeApi } from './commons';
import { IAllExecuteFunctions } from 'n8n-workflow';
import { CreateWebhook, Webhook } from '../models';
import { APIResponse } from '../../response';

/**
 * Endpoint path for Lime CRM Subscription API.
 *
 * @internal
 * @group Transport
 */
const SUBSCRIPTION_URL = 'api/v1/subscription/';

/**
 * Representation of response format for a Lime CRM webhook subscription.
 *
 * @property {string} id - Unique identifier of the subscription
 * @property {string} name - Name of the subscription
 * @property {boolean} enabled - Whether the subscription is currently enabled
 * @property {string[]} events - List of events the subscription is listening for
 * @property {string} target_url - Target URL for the webhook
 *
 * @public
 * @group Transport
 */
export interface ApiResponseWebhook {
    id: string;
    name: string;
    enabled: boolean;
    events: string[];
    target_url: string;
}

/**
 * Retrieve details of a specific subscription from Lime CRM.
 *
 * @param nodeContext - The n8n node execution context
 * @param webhookId - Id of a webhook containing subscription details
 *
 * @returns The subscription information from Lime CRM.
 *
 * @public
 * @group Transport
 */
export async function getSubscription(
    nodeContext: IAllExecuteFunctions,
    webhookId: string
): Promise<APIResponse<ApiResponseWebhook>> {
    return await callLimeApi(nodeContext, {
        method: 'GET',
        url: `${SUBSCRIPTION_URL}${webhookId}`,
    });
}

/**
 * List all active subscriptions that match the given webhook events and target URL.
 *
 * @param nodeContext - The n8n node execution context
 * @param webhook - The webhook instance containing event and URL information
 *
 * @returns Array of subscription objects from Lime CRM.
 *
 * @public
 * @group Transport
 */
export async function listSubscriptionsWithExistingData(
    nodeContext: IAllExecuteFunctions,
    webhook: Webhook
): Promise<APIResponse<ApiResponseWebhook[]>> {
    return await callLimeApi(nodeContext, {
        method: 'GET',
        url: SUBSCRIPTION_URL,
        requestOptions: {
            qs: {
                events: webhook.events.join(','),
                target_url: webhook.url,
                enabled: true,
            },
        },
    });
}

/**
 * Creates a new webhook subscription in Lime CRM.
 *
 * @param nodeContext - The n8n node execution context.
 * @param webhook - The webhook configuration to create.
 *
 * @returns The newly created subscription object.
 *
 * @public
 * @group Transport
 */
export async function createSubscription(
    nodeContext: IAllExecuteFunctions,
    webhook: CreateWebhook
): Promise<APIResponse<ApiResponseWebhook>> {
    return await callLimeApi(nodeContext, {
        method: 'POST',
        url: SUBSCRIPTION_URL,
        requestOptions: {
            body: {
                events: webhook.events,
                target_url: webhook.url,
                name: webhook.name,
                secret: webhook.secret,
            },
        },
    });
}

/**
 * Delete a webhook subscription from Lime CRM.
 *
 * @param nodeContext - The n8n node execution context
 * @param webhookId - ID of a webhook that should be deleted
 *
 * @returns Response indicating success or failure of the deletion.
 *
 * @public
 * @group Transport
 */
export async function deleteSubscription(
    nodeContext: IAllExecuteFunctions,
    webhookId: string
): Promise<APIResponse<void>> {
    return await callLimeApi(nodeContext, {
        method: 'DELETE',
        url: `${SUBSCRIPTION_URL}${webhookId}/`,
        errorMetadata: {
            id: webhookId,
        },
    });
}
