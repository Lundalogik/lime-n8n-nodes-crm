import { Webhook, WebhookContext, WebhookFunctions } from '../models';

/**
 * Extract and format event identifiers from the node parameters.
 *
 * Builds an array of event strings in the format `<limetype>.<eventType>`
 * based on the selected events.
 *
 * @param hookData - The n8n hook context
 * @returns An array of formatted event strings.
 *
 * @internal
 * @group Utils
 */
function getEvents(hookData: WebhookFunctions): string[] {
	const eventData = hookData.getNodeParameter('events', []) as {
		event: Array<{
			limetype: string;
			eventType: string;
		}>;
	};
	const eventItems = eventData.event;
	const events: string[] = [];
	for (const eventItem of eventItems) {
		events.push(`${eventItem.limetype}.${eventItem.eventType}`);
	}
	return events;
}

/**
 * Generate a unique webhook name based on the selected Lime type and event.
 *
 * The name is constructed using the format:
 * `<limetype>-<eventType>-<timestamp>`, ensuring uniqueness for each webhook.
 *
 * @param hookData - The n8n hook context used to access node parameters
 * @returns A unique webhook name string.
 *
 * @internal
 * @group Utils
 */
function createWebhookName(hookData: WebhookFunctions): string {
	interface Events {
		event: Array<{
			limetype: string;
			eventType: string;
		}>;
	}

	const events = hookData.getNodeParameter('events') as Events;
	return `${events.event[0].limetype}-${events.event[0].eventType}-${Date.now()}`;
}

/**
 * Retrieve a fully constructed webhook object from the given node context.
 *
 * @param hookData - The n8n node context
 *
 * @returns A {@link Webhook} object with a generated name
 *
 * @public
 * @group Utils
 */
export function getWebhook(hookData: WebhookFunctions): Webhook {
	const node = hookData.getNode();
	const workflow = hookData.getWorkflow();
	const context: WebhookContext = {
		nodeId: node.id,
		nodeName: node.name,
		workflowId: workflow.id,
		workflowName: workflow.name,
	};

	return {
		data: hookData.getWorkflowStaticData('node'),
		events: getEvents(hookData),
		url: hookData.getNodeWebhookUrl('default'),
		context: context,
		name: createWebhookName(hookData),
	};
}
