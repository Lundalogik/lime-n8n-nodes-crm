import { IDataObject } from 'n8n-workflow';
import { LimetypeProperty } from '../models';

/**
 * Lime CRM property types that hold plain text. These properties can never be
 * `null` in Lime CRM: a cleared text field is stored as an empty string.
 *
 * @public
 * @group Utils
 */
export const TEXT_PROPERTY_TYPES: ReadonlySet<string> = new Set([
	'string',
	'text',
	'phone',
	'link',
]);

/**
 * Replace `null` values of text properties with an empty string.
 *
 * Lime CRM rejects `null` for text-like properties, while integrations often
 * produce `null` for unfilled fields (e.g. an empty form field). Since a
 * cleared text field in Lime CRM is an empty string, `null` is translated to
 * `''` for every property of a text type. Properties of other types are left
 * untouched, because `null` carries meaning for them.
 *
 * @param data - Property values to send to Lime CRM
 * @param properties - Properties of the target Limetype
 * @returns A copy of `data` with `null` text values replaced by `''`
 *
 * @public
 * @group Utils
 */
export function replaceNullTextValues(
	data: IDataObject,
	properties: LimetypeProperty[],
): IDataObject {
	const result: IDataObject = { ...data };
	for (const property of properties) {
		if (TEXT_PROPERTY_TYPES.has(property.type) && result[property.name] === null) {
			result[property.name] = '';
		}
	}
	return result;
}
