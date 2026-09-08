import { FieldType, IDataObject, ResourceMapperField } from 'n8n-workflow';
import { SerializerFn, SerializedValue, SerializerError } from './commons';

interface ResourceMapperFieldMap {
    [id: string]: FieldType;
}

/**
 * Serializes a given value into an ISO 8601 datetime string.
 *
 * This function accepts a value of type stringr, interprets it as a date,
 * and converts it into a standardized ISO 8601 string representation of the datetime.
 *
 * Throws an error if the provided value is not of type string, or if
 * the value cannot be successfully parsed into a valid date.
 *
 * @param value - The input value to be serialized, expected
 * to represent a date. Must be a string.
 * @throws {SerializerError} If the input value is not a string or does not represent a date.
 * @returns The ISO 8601 formatted string representation of the datetime.
 */
const serializeDatetime: SerializerFn = (value) => {
    if (typeof value !== 'string') {
        throw new SerializerError(
            `Expected string as dateTime, got ${typeof value}`
        );
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new SerializerError(`Invalid date value: ${String(value)}`);
    }
    return date.toISOString();
};

/**
 * A mapping of field types to their corresponding serializer functions.
 * This map is used to associate specific field types with the appropriate
 * logic for serializing their values.
 */
const SerializerMap: Partial<Record<FieldType, SerializerFn>> = {
    dateTime: serializeDatetime,
};

/**
 * Serializes the provided value using the serializer mapped to the specified Lime CRM type.
 *
 * This function retrieves a serializer associated with the given `limeCrmType` from
 * the `SerializerMap`. If a serializer is found, it processes the `value`
 * with the serializer and returns the serialized result. If no serializer is found
 * for the specified type, the function returns the original value unchanged.
 *
 * @param value - The value to be serialized or returned as-is.
 * @param type
 * @returns - The serialized value or the original value if no
 *                                serializer is found.
 */
const getSerializedValue = (
    value: SerializedValue,
    type: FieldType
): SerializedValue => {
    const serializer = SerializerMap[type];
    return serializer === undefined ? value : serializer(value);
};

/**
 * Converts an array of resource mapper fields into a mapped object where
 * the field IDs serve as keys and their corresponding types as values.
 *
 * @param schema - The input array of resource mapper fields.
 * @returns An object mapping each field ID to its corresponding type.
 */
const fetchResourceMapperFieldMap = (
    schema: ResourceMapperField[]
): ResourceMapperFieldMap => {
    const resourceMapperFieldMap: ResourceMapperFieldMap = {};
    for (const field of schema) {
        if (field.type) {
            resourceMapperFieldMap[field.id] = field.type;
        }
    }
    return resourceMapperFieldMap;
};

/**
 * Serializes resource mapper values based on the provided schema.
 *
 * This function takes a set of resource mapper values and a corresponding schema,
 * and transforms the values into a serialized format as defined by the schema.
 *
 * @param resourceMapperValues - An object containing the key-value pairs of resource values to be serialized.
 * @param resourceMapperSchema - An array defining the schema for serializing the resource values.
 * @returns The serialized representation of the resource values, structured according to the provided schema.
 */
export const serializeResourceMapperValues = (
    resourceMapperValues: IDataObject,
    resourceMapperSchema: ResourceMapperField[]
): IDataObject => {
    const serializedData: IDataObject = {};
    const resourceMapperFieldMap =
        fetchResourceMapperFieldMap(resourceMapperSchema);
    for (const resourceMapperValue in resourceMapperValues) {
        if (resourceMapperValues[resourceMapperValue] !== undefined) {
            serializedData[resourceMapperValue] = getSerializedValue(
                resourceMapperValues[resourceMapperValue],
                resourceMapperFieldMap[resourceMapperValue]
            );
        }
    }
    return serializedData;
};
