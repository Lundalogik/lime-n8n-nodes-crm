import { APIResponseValue } from './constants';

/**
 * Limetype option used only for fields with `option` type.
 * @property key - ID of an option, used as a value for POST/PUT requests in API
 * @property text - display name of an option
 * @property inactive - flag describing whether the property is used or not
 */
type LimetypePropertyOption = {
	key: string;
	text: string;
	inactive: boolean;
};

/**
 * Representation of a property of a Limetype.
 *
 * @property name - The internal name of the property
 * @property localname - The display name of the property
 * @property type - The type of the property (e.g., string, file, hasmany)
 * @property required - describes whether a property is required or not
 * @property options - a set of {@link LimetypePropertyOption} used only for
 * fields with type `option`.
 *
 * @public
 * @group Models
 */
export type LimetypeProperty = {
	name: string;
	localname: string;
	type: string;
	required: boolean;
	length?: number;
	options?: LimetypePropertyOption[];
	relatedLimetype?: string;
} & Record<string, APIResponseValue>;

/**
 * Localized names for a Limetype.
 *
 * @property singular - Singular display name
 * @property plural - Plural display name
 *
 * @public
 * @group Models
 */
export type LimetypeLocalName = {
	singular: string;
	plural: string;
};

/**
 * Representation of a Limetype.
 *
 * @property name - Internal name of the Limetype
 * @property localname - Localized names
 * @property properties - List of properties of this Limetype
 *
 * @public
 * @group Models
 */
export type Limetype = {
	name: string;
	localname: LimetypeLocalName;
	properties: LimetypeProperty[];
} & Record<string, APIResponseValue>;
