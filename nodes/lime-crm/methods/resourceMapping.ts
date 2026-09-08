import {
    FieldType,
    ILoadOptionsFunctions,
    ResourceMapperFields,
    LoggerProxy as Logger,
    IExecuteFunctions,
    IDataObject,
    ResourceMapperValue,
} from 'n8n-workflow';
import { getProperties } from '../transport';
import { LimetypeProperty } from '../models';
import { serializeResourceMapperValues } from '../serializers';
/**
 * A map of Lime CRM field types to n8n native types
 */
const LimeCrmTypeToFieldType = new Map(
    Object.entries({
        option: 'options',
        yesno: 'boolean',
        decimal: 'number',
        number: 'number',
        time: 'dateTime',
        date: 'dateTime',
    })
);

/**
 * Function which maps Lime CRM to n8n types using the map above. If the type
 * is not declared in a map, string is used.
 * @param limeCrmType
 * @returns n8n native {@link FieldType}
 */
function mapLimeCrmType(limeCrmType: string): FieldType {
    return (LimeCrmTypeToFieldType.get(limeCrmType) as FieldType) || 'string';
}

/**
 * Get a `length` addition to the input headers when there's a string field
 *
 * @param property - a {@link LimetypeProperty}
 * @returns a string with length wrapped in quotes or an empty string
 */
function getPropertyLength(property: LimetypeProperty): string {
    const length =
        property.length !== undefined && property.length < 10_000
            ? property.length
            : 'max';
    return ['string', 'text', 'link'].includes(property.type)
        ? `(${length})`
        : '';
}

/**
 * Base function to get the description of ResourceMapper fields
 * @param nodeContext
 * @param mode - either `create` or `update` - based on this flag a `required`
 * @param limetype - name of a limetype we are creating or updating
 * property is set
 */
async function getMappingColumns(
    nodeContext: ILoadOptionsFunctions,
    mode: 'create' | 'update',
    limetype: string
): Promise<ResourceMapperFields> {
    const propertiesResponse = await getProperties(nodeContext, limetype);
    if (!propertiesResponse.success) {
        Logger.error(
            `There was an error with fetching properties: ${JSON.stringify(propertiesResponse.data)}`
        );
        return {
            fields: [],
        };
    }
    const noRelationProperties = propertiesResponse.data.filter(
        (property) => property.type !== 'hasmany'
    );

    const fields = noRelationProperties.map((property) => {
        const propertyLengthDescription = getPropertyLength(property);
        return {
            id: property.name,
            displayName: `${property.localname} [${property.type}${propertyLengthDescription}]`,
            required: mode === 'create' ? property.required : false,
            defaultMatch: false,
            display: true,
            type: mapLimeCrmType(property.type),
            options:
                property.type === 'option' && property.options
                    ? property.options
                          .filter((option) => !option.inactive)
                          .map((option) => {
                              return {
                                  value: option.key,
                                  name: option.text,
                              };
                          })
                    : undefined,
        };
    });
    return {
        fields: fields.sort((a, b) => {
            if (a.required !== b.required) {
                return a.required ? -1 : 1;
            }
            return a.displayName.localeCompare(b.displayName);
        }),
    };
}
/**
 * Parse resource mapper fields from n8n workflow
 * @param context - Node execution context
 * @param i - The index of the current item in the workflow execution
 * @param inputName - name of the resource mapper input
 * @returns IDataObject - parsed data from resource mapper
 */

export function parseResourceMapperFields(
    context: IExecuteFunctions,
    i: number,
    inputName: string
): IDataObject {
    const propertiesInput = context.getNodeParameter(
        inputName,
        i
    ) as ResourceMapperValue;

    const parsedData = propertiesInput.value as IDataObject;

    return serializeResourceMapperValues(
        parsedData,
        propertiesInput.schema
    ) as IDataObject;
}

/**
 * Method for getting resource mapper fields in `create` mode
 */
export async function getCreateMappingColumns(
    this: ILoadOptionsFunctions
): Promise<ResourceMapperFields> {
    const limetype = this.getNodeParameter('limetype', undefined, {
        extractValue: true,
    }) as string;
    return getMappingColumns(this, 'create', limetype);
}

/**
 * Method for getting resource mapper fields in `update` mode
 */
export async function getUpdateMappingColumns(
    this: ILoadOptionsFunctions
): Promise<ResourceMapperFields> {
    const limetype = this.getNodeParameter('limetype', undefined, {
        extractValue: true,
    }) as string;
    return getMappingColumns(this, 'update', limetype);
}

/**
 * Method for getting relation lookup fields as a resource mapper.
 * Shows one picker per relation (belongsto/hasone) with the related object's properties.
 */
export async function getRelationLookupMappingColumns(
    this: ILoadOptionsFunctions
): Promise<ResourceMapperFields> {
    const limetype = this.getNodeParameter('limetype', undefined, {
        extractValue: true,
    }) as string;
    if (!limetype) {
        return { fields: [] };
    }

    const propertiesResponse = await getProperties(this, limetype);
    if (!propertiesResponse.success) {
        Logger.error(
            `There was an error with fetching properties: ${JSON.stringify(propertiesResponse.data)}`
        );
        return { fields: [] };
    }

    // Find all relation properties (belongsto/hasone)
    const relationProperties = propertiesResponse.data.filter(
        (property) =>
            property.type === 'belongsto' || property.type === 'hasone'
    );

    const fields = await Promise.all(
        relationProperties.map(async (relationProp) => {
            const relatedLimetype = relationProp.relatedLimetype as string;
            const relationDisplayName =
                relationProp.localname || relationProp.name;

            if (!relatedLimetype) {
                Logger.warn(
                    `No relatedLimetype found for ${relationProp.name}`
                );
                return null;
            }

            // Fetch properties from the related limetype
            const relatedPropertiesResponse = await getProperties(
                this,
                relatedLimetype
            );
            if (!relatedPropertiesResponse.success) {
                return null;
            }

            // Get available lookup properties (exclude hasmany relations)
            const lookupOptions = relatedPropertiesResponse.data
                .filter((p) => p.type !== 'hasmany')
                .map((p) => ({
                    value: p.name,
                    name: `${p.localname || p.name} [${p.type}]`,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return {
                id: relationProp.name,
                displayName: `${relationDisplayName}`,
                required: false,
                defaultMatch: false,
                display: true,
                type: 'options' as FieldType,
                options: lookupOptions,
            };
        })
    );

    return {
        fields: fields
            .filter((f): f is NonNullable<typeof f> => f !== null)
            .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
}
