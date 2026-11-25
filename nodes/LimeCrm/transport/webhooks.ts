import { callLimeApi } from './commons';
import { IAllExecuteFunctions, JsonObject, NodeApiError } from 'n8n-workflow';
import { CreateWebhook, Webhook } from '../models';
import { APIResponse } from '../../response';
import { SIGNATURE_VERSION_V1, SIGNATURE_VERSION_V2, SignatureVersion } from '../../crypto';

/**
 * Subscription endpoints of the Lime CRM webhooks API. The version of the
 * API a subscription is created through decides how its deliveries are
 * signed: version 1 signs the body, version 2 signs the delivery id, the
 * delivery timestamp and the body. Both versions list and manage the same
 * subscriptions.
 *
 * @internal
 */
const SUBSCRIPTION_URL = 'api/v1/subscription/';
const SUBSCRIPTION_URL_V2 = 'api/v2/subscription/';

/**
 * @param version - The signature version of the subscription
 * @returns The subscription endpoint of the matching API version
 *
 * @internal
 */
function subscriptionUrl(version: SignatureVersion): string {
	return version === SIGNATURE_VERSION_V2 ? SUBSCRIPTION_URL_V2 : SUBSCRIPTION_URL;
}

/**
 * Subscription as returned by the Lime CRM webhooks API.
 *
 * @property signature_version - Absent from servers that only know version 1
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
	signature_version?: SignatureVersion;
}

/**
 * A subscription that was just created, with the signature version it will
 * deliver with.
 *
 * @public
 * @group Transport
 */
export type CreatedSubscription = ApiResponseWebhook & {
	signatureVersion: SignatureVersion;
};

/**
 * Whether an error from {@link callLimeApi} is a 404, as thrown when the
 * node is not allowed to continue on fail, or as returned when it is.
 *
 * @param error - The thrown error or the returned error context
 * @returns `true` for a 404
 *
 * @internal
 */
function isNotFound(error: unknown): boolean {
	const candidate = error as { httpCode?: unknown; status?: unknown; cause?: { status?: unknown } };
	const status = candidate?.httpCode ?? candidate?.status ?? candidate?.cause?.status;
	return Number(status) === 404;
}

/**
 * Get a subscription by id, through the API version it was created with.
 *
 * @param nodeContext - The n8n execution context
 * @param webhookId - The id of the subscription
 * @param version - The signature version of the subscription
 *
 * @public
 * @group Transport
 */
export async function getSubscription(
	nodeContext: IAllExecuteFunctions,
	webhookId: string,
	version: SignatureVersion = SIGNATURE_VERSION_V1,
): Promise<APIResponse<ApiResponseWebhook>> {
	return await callLimeApi(nodeContext, {
		method: 'GET',
		url: `${subscriptionUrl(version)}${webhookId}`,
	});
}

/**
 * List the enabled subscriptions that have the same events and target URL
 * as the given webhook.
 *
 * @param nodeContext - The n8n execution context
 * @param webhook - The webhook to look for
 *
 * @public
 * @group Transport
 */
export async function listSubscriptionsWithExistingData(
	nodeContext: IAllExecuteFunctions,
	webhook: Webhook,
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
 * Create a subscription.
 *
 * The version 2 API is tried first. A server that does not have it answers
 * 404, in which case the subscription is created through version 1 and
 * delivers with version 1 signatures. The version the subscription signs
 * with is returned as `signatureVersion`.
 *
 * @param nodeContext - The n8n execution context
 * @param webhook - The webhook to register
 *
 * @public
 * @group Transport
 */
export async function createSubscription(
	nodeContext: IAllExecuteFunctions,
	webhook: CreateWebhook,
): Promise<APIResponse<CreatedSubscription>> {
	const body = {
		events: webhook.events,
		target_url: webhook.url,
		name: webhook.name,
		secret: webhook.secret,
	};
	const post = async (url: string): Promise<APIResponse<ApiResponseWebhook>> =>
		await callLimeApi(nodeContext, { method: 'POST', url, requestOptions: { body } });

	let version = SIGNATURE_VERSION_V2;
	let response: APIResponse<ApiResponseWebhook> | undefined;
	try {
		response = await post(SUBSCRIPTION_URL_V2);
	} catch (error) {
		if (!isNotFound(error)) {
			throw new NodeApiError(nodeContext.getNode(), error as JsonObject);
		}
	}
	if (response === undefined || (!response.success && isNotFound(response.data.error))) {
		version = SIGNATURE_VERSION_V1;
		response = await post(SUBSCRIPTION_URL);
	}
	if (!response.success) {
		return response;
	}
	return {
		success: true,
		data: {
			...response.data,
			signatureVersion: response.data.signature_version ?? version,
		},
	};
}

/**
 * Delete a subscription by id, through the API version it was created with.
 *
 * @param nodeContext - The n8n execution context
 * @param webhookId - The id of the subscription
 * @param version - The signature version of the subscription
 *
 * @public
 * @group Transport
 */
export async function deleteSubscription(
	nodeContext: IAllExecuteFunctions,
	webhookId: string,
	version: SignatureVersion = SIGNATURE_VERSION_V1,
): Promise<APIResponse<void>> {
	return await callLimeApi(nodeContext, {
		method: 'DELETE',
		url: `${subscriptionUrl(version)}${webhookId}/`,
		errorMetadata: {
			id: webhookId,
		},
	});
}
