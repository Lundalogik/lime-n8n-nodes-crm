// Credentials

/**
 * Credential name for Lime CRM API nodes.
 *
 * @public
 * @group Models
 */
export const LIME_CRM_API_CREDENTIAL_KEY = 'limeCrmApi';

// Resources

/**
 * Resource name for administrative data operations.
 *
 * @public
 * @group Models
 */
export const ADMIN_RESOURCE = 'admin';

/**
 * Resource name for main data operations.
 *
 * @public
 * @group Models
 */
export const DATA_RESOURCE = 'data';

/**
 * Resource name for metadata-related operations.
 *
 * @public
 * @group Models
 */
export const METADATA_RESOURCE = 'metadata';

/**
 * Resource name for ERP connector-related operations.
 *
 * @internal
 * @group Models
 */
export const ERP_CONNECTOR_RESOURCE = 'erpConnector';

// Types

/**
 * Helper type used when none value was provided in N8N form
 * @public
 * @group Models
 */
export type NullOptionType = '';

/**
 * Wrapper for generic return type of Lime CRM API values
 */
export type APIResponsePrimitiveValue = string | boolean | number | null;

/**
 * Wrapper for types of Lime CRM API values
 */
export type APIResponseValue =
    | APIResponsePrimitiveValue
    | APIResponsePrimitiveValue[]
    | Record<string, APIResponsePrimitiveValue>;

// API
/**
 * Default limit when working with Lime CRM API
 * @public
 * @group Models
 */
export const DEFAULT_API_OBJECT_LIMIT = 50;
