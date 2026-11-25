import {
	ICredentialDataDecryptedObject,
	IHookFunctions,
	IWebhookFunctions,
	NodeOperationError,
} from 'n8n-workflow';

/**
 * The credential fields that can hold a webhook secret, with their labels.
 *
 * A credential has two secret fields so that the secret can be rotated by
 * filling in the empty one and switching the active one. n8n never shows a
 * saved secret again, so a rotation cannot rely on the user copying the
 * current value anywhere.
 *
 * @internal
 * @group Utils
 */
export const WEBHOOK_SECRET_FIELDS: Record<string, string> = {
	webhookSecret: 'Webhook Secret',
	secondWebhookSecret: 'Second Webhook Secret',
};

/**
 * The credential field that selects which secret field is active.
 *
 * @internal
 * @group Utils
 */
export const ACTIVE_WEBHOOK_SECRET_FIELD = 'activeWebhookSecretId';

const DEFAULT_ACTIVE_WEBHOOK_SECRET_FIELD = 'webhookSecret';

const isSecret = (value: unknown): value is string => typeof value === 'string' && value !== '';

/**
 * Name of the credential field that holds the active webhook secret.
 *
 * A credential saved before the second secret existed has no selection and
 * uses the original field.
 *
 * @param credentials - The decrypted credential data
 * @returns The name of the active secret field.
 *
 * @internal
 * @group Utils
 */
export function getActiveWebhookSecretField(credentials: ICredentialDataDecryptedObject): string {
	const active = credentials[ACTIVE_WEBHOOK_SECRET_FIELD];
	return typeof active === 'string' && active in WEBHOOK_SECRET_FIELDS
		? active
		: DEFAULT_ACTIVE_WEBHOOK_SECRET_FIELD;
}

/**
 * Read the active webhook secret from the credential used by the trigger node.
 *
 * The secret is stored in the credential so that n8n keeps it encrypted at
 * rest. It is sent to Lime when the webhook is registered and used to verify
 * the HMAC signature of each incoming webhook request.
 *
 * @param context - The n8n hook or webhook context of the trigger node
 * @param credentialType - Name of the credential type holding the secret
 * @returns The active webhook secret from the credential.
 *
 * @throws {NodeOperationError} If the active secret field of the credential is empty.
 *
 * @public
 * @group Utils
 */
export async function getWebhookSecret(
	context: IHookFunctions | IWebhookFunctions,
	credentialType: string,
): Promise<string> {
	const credentials = await context.getCredentials(credentialType);
	const activeField = getActiveWebhookSecretField(credentials);
	const webhookSecret = credentials[activeField];
	if (!isSecret(webhookSecret)) {
		throw new NodeOperationError(
			context.getNode(),
			`The credential has no ${WEBHOOK_SECRET_FIELDS[activeField]}. Add one to the ` +
				'credential and re-activate the workflow.',
		);
	}
	return webhookSecret;
}

/**
 * Read the secrets a delivery may be signed with: the active webhook secret
 * and, while a rotation is in progress, the other one.
 *
 * Lime signs with the secret a subscription was registered with. After the
 * active secret is switched, subscriptions keep the old secret until their
 * workflow is re-activated, so both secrets have to be accepted for them to
 * keep working.
 *
 * @param context - The n8n hook or webhook context of the trigger node
 * @param credentialType - The credential type that holds the secrets
 * @returns The active secret first, then the other one if it is set
 *
 * @throws {NodeOperationError} if the active secret field of the credential is empty
 *
 * @public
 * @group Utils
 */
export async function getWebhookSecrets(
	context: IHookFunctions | IWebhookFunctions,
	credentialType: string,
): Promise<string[]> {
	const webhookSecret = await getWebhookSecret(context, credentialType);
	const credentials = await context.getCredentials(credentialType);
	const activeField = getActiveWebhookSecretField(credentials);
	const otherSecrets = Object.keys(WEBHOOK_SECRET_FIELDS)
		.filter((field) => field !== activeField)
		.map((field) => credentials[field])
		.filter((secret): secret is string => isSecret(secret) && secret !== webhookSecret);
	return [webhookSecret, ...otherSecrets];
}
