import { serializeResourceMapperValues, SerializerError } from '../../../nodes';
import { FieldType } from 'n8n-workflow';

describe('serializeResourceMapperValues', () => {
    it('should serialize dateTime fields to ISO 8601 format', () => {
        const resourceMapperValues = {
            dateField: '2026-02-13', // default string date format
            stringField: 'test',
            numberField: 123,
        };
        const resourceMapperSchema = [
            {
                id: 'dateField',
                type: 'dateTime' as FieldType,
                displayName: 'Date Field',
                defaultMatch: false,
                required: true,
                display: true,
            },
            {
                id: 'stringField',
                type: 'string' as FieldType,
                displayName: 'String Field',
                defaultMatch: false,
                required: true,
                display: true,
            },
            {
                id: 'numberField',
                type: 'number' as FieldType,
                displayName: 'Number Field',
                defaultMatch: false,
                required: true,
                display: true,
            },
        ];
        const result = serializeResourceMapperValues(
            resourceMapperValues,
            resourceMapperSchema
        );
        expect(result.dateField).toBe('2026-02-13T00:00:00.000Z');
        expect(result.stringField).toBe('test');
        expect(result.numberField).toBe(123);
    });

    it('should throw error for invalid dateTime type', () => {
        const resourceMapperValues = {
            dateField: {},
        };
        const resourceMapperSchema = [
            {
                id: 'dateField',
                type: 'dateTime' as FieldType,
                displayName: 'Date Field',
                defaultMatch: false,
                required: true,
                display: true,
                defaultValue: null,
            },
        ];
        expect(() =>
            serializeResourceMapperValues(
                resourceMapperValues,
                resourceMapperSchema
            )
        ).toThrow(SerializerError);
    });

    it('should throw error for empty string as dateTime', () => {
        const resourceMapperValues = {
            dateField: '',
        };
        const resourceMapperSchema = [
            {
                id: 'dateField',
                type: 'dateTime' as FieldType,
                displayName: 'Date Field',
                defaultMatch: false,
                required: true,
                display: true,
                defaultValue: null,
            },
        ];
        expect(() =>
            serializeResourceMapperValues(
                resourceMapperValues,
                resourceMapperSchema
            )
        ).toThrow(SerializerError);
    });
});
