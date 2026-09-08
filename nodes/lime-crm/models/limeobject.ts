import { APIResponseValue } from './constants';

/**
 * Representation of a Limeobject returned by the Lime CRM API.
 *
 * @property id_ - The unique ID of the Limeobject
 *
 * @public
 * @group Models
 */
export type Limeobject = {
	id_: number;
} & Record<string, APIResponseValue>;
