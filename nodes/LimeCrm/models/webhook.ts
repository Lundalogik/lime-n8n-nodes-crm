import { IDataObject, IHookFunctions, IWebhookFunctions } from 'n8n-workflow';

/**
 * Available webhook execution contexts in n8n.
 *
 * It can be either IHookFunctions or IWebhookFunctions,
 * depending on the lifecycle stage of the node.
 *
 * @internal
 * @group Models
 */
export type WebhookFunctions = IHookFunctions | IWebhookFunctions;

/**
 * Contextual information about a webhook, including its node and workflow details.
 *
 * @property nodeId - The unique identifier of the node
 * @property nodeName - The name of the node (optional)
 * @property workflowId - The unique identifier of the workflow (optional)
 * @property workflowName - The name of the workflow (optional)
 *
 * @public
 * @group Models
 */
export interface WebhookContext {
	nodeId: string;
	nodeName?: string;
	workflowId?: string;
	workflowName?: string;
}

/**
 * Represent a webhook object.
 *
 * @property data - Arbitrary workflow data associated with this webhook
 * @property events - List of events that this webhook is subscribed to
 * @property url - Optional URL of the webhook
 * @property context - Context about the node and workflow that owns the webhook
 * @property name - Name of the webhook
 *
 * @public
 * @group Models
 */
export interface Webhook {
	data: IDataObject & { webhookId?: string; webhookSecret?: string };
	events: string[];
	url?: string;
	context: WebhookContext;
	name: string;
}

/**
 * Extend {@link Webhook} with an optional secret for secure webhooks.
 *
 * @property secret - Optional secret used to verify webhook requests
 * @public
 * @group Models
 */
export interface CreateWebhook extends Webhook {
	secret?: string;
}
