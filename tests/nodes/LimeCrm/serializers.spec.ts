import { serializeResourceMapperValues, SerializerError } from '../../../nodes';
import { FieldType } from 'n8n-workflow';

describe('serializeResourceMapperValues', () => {
	it('should serialize dateTime fields to ISO 8601 format', () => {
		const resourceMapperValues = {
			dateField: '2026-02-13',
			stringField: 'test',
			numberField: 123,
		};
		const resourceMapperValuesWithEmptyString = {
			dateField: '',
		};
		const resourceMapperValuesWithNull = {
			dateField: null,
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
		const result = serializeResourceMapperValues(resourceMapperValues, resourceMapperSchema);
		expect(result.dateField).toBe('2026-02-13T00:00:00.000Z');
		expect(result.stringField).toBe('test');
		expect(result.numberField).toBe(123);

		const resultWithNull = serializeResourceMapperValues(
			resourceMapperValuesWithNull,
			resourceMapperSchema,
		);
		expect(resultWithNull.dateField).toBe(null);

		const resultWithEmptySttring = serializeResourceMapperValues(
			resourceMapperValuesWithEmptyString,
			resourceMapperSchema,
		);
		expect(resultWithEmptySttring.dateField).toBe(null);
	});

	it('should throw error for invalid dateTime', () => {
		const resourceMapperValues = {
			dateField: 'invalid',
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
		expect(() => serializeResourceMapperValues(resourceMapperValues, resourceMapperSchema)).toThrow(
			SerializerError,
		);
	});
});
