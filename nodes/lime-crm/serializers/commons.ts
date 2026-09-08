import { GenericValue, IDataObject } from 'n8n-workflow';

/**
 * A type that represents a serialized value in the system.
 * It can either be a GenericValue, which is a broad, flexible type,
 * or an IDataObject, which is a structure adhering to a specific data format.
 */
export type SerializedValue = GenericValue | IDataObject;

/**
 * A type definition for a serializer function that transforms a value of type `GenericValue`
 * into a value of type `SerializedValue`.
 *
 * This function is typically used to process and convert data into a desired format suitable
 * for a specific application or context.
 *
 * @callback SerializerFn
 * @param {GenericValue} value - The input value to be serialized or transformed.
 * @returns {SerializedValue} - The resulting transformed value.
 */
export type SerializerFn = (value: GenericValue) => SerializedValue;

/**
 * Custom error class for serialization errors.
 */
export class SerializerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SerializerError';
        Object.setPrototypeOf(this, SerializerError.prototype);
    }
}
