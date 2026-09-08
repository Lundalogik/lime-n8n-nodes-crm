import {
    ILoadOptionsFunctions,
    INodePropertyOptions,
    LoggerProxy as Logger,
} from 'n8n-workflow';
import { getProperties } from '../transport/';

/**
 * Fetch all properties for a specific Lime type.
 *
 * This is an internal helper function used by other load-options methods.
 * It calls the Lime API to retrieve properties for the selected Limetype.
 *
 * @param nodeContext - The n8n load options context
 * @returns An array of properties if successful, or an empty array otherwise.
 *
 * @internal
 * @group Load Options Methods
 */
async function fetchAllProperties(nodeContext: ILoadOptionsFunctions) {
    const limetype = nodeContext.getNodeParameter('limetype', '', {
        extractValue: true,
    }) as string;
    Logger.info(`Fetching file properties for Lime type: ${limetype}`);
    if (!limetype) return [];
    try {
        const response = await getProperties(nodeContext, limetype);
        if (!response.success) return [];
        return response.data;
    } catch (error) {
        Logger.warn(`There was a problem with fetching properties: ${error}`);
        return [];
    }
}

/**
 * Gets property options from a specific Limetype
 *
 * It's not meant to be used directly in 'loadOptionsMethod'
 *
 * This function fetches properties for the specified Limetype and optionally filters them
 * based on allowed types.
 *
 * @param [loader] - The n8n load options context
 * @param [allowedTypes] - Optional set of property types to filter by
 * @param [forbiddenType] - Optional set of property types to exclude
 * @returns Array of formatted property options
 *
 * @public
 * @group Load Options Methods
 */
export async function getFilteredLimetypeProperties(
    loader: ILoadOptionsFunctions,
    allowedTypes?: Set<string>,
    forbiddenType?: Set<string>
): Promise<INodePropertyOptions[]> {
    const properties = await fetchAllProperties(loader);

    return properties
        .filter(
            (property) =>
                (!allowedTypes || allowedTypes.has(property.type)) &&
                (!forbiddenType || !forbiddenType.has(property.type))
        )
        .map((property) => ({
            name: (property.localname as string) || (property.name as string),
            value: property.name as string,
            description: `Type: ${property.type as string} | Name: ${property.name as string}${(property.required as boolean) ? ' (Required)' : ''}`,
            type: property.type,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all property options for the current Limetype.
 *
 * @returns Array of property options for the current Limetype.
 *
 * @public
 * @group Load Options Methods
 */
export async function getLimetypeProperties(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    return getFilteredLimetypeProperties(this);
}

/**
 * Get only file property options for the current Limetype.
 *
 * @returns Array of file property options
 *
 * @public
 * @group Load Options Methods
 */
export async function getFileProperties(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    return getFilteredLimetypeProperties(this, new Set(['file']));
}

/**
 * Get property options excluding those of type 'hasmany'.
 *
 * @returns Array of property options excluding 'hasmany' types
 *
 * @public
 * @group Load Options Methods
 */
export async function getNoHasManyProperties(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    return getFilteredLimetypeProperties(this, undefined, new Set(['hasmany']));
}

/**
 * Get only relation properties (belongsto/hasone) for the current Limetype.
 *
 * @returns Array of relation property options
 *
 * @public
 * @group Load Options Methods
 */
export async function getRelationProperties(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    return getFilteredLimetypeProperties(
        this,
        new Set(['belongsto', 'hasone'])
    );
}

/**
 * Get properties from ALL related limetypes for relation fields.
 *
 * This method finds all relation properties (belongsto/hasone) on the current limetype,
 * fetches properties from each related limetype, and returns them grouped by limetype.
 * Each option is prefixed with the relation field name for clarity.
 *
 * @returns Array of property options from all related limetypes, grouped by relation
 *
 * @public
 * @group Load Options Methods
 */
export async function getRelationPropertiesWithLookupField(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    const limetype = this.getNodeParameter('limetype', '', {
        extractValue: true,
    }) as string;

    if (!limetype) return [];

    const propertiesResponse = await getProperties(this, limetype);
    if (!propertiesResponse.success) return [];

    const relationProperties = propertiesResponse.data.filter(
        (p) => p.type === 'belongsto' || p.type === 'hasone'
    );

    const allOptions: INodePropertyOptions[] = [];
    for (const relationProp of relationProperties) {
        const relatedLimetype = relationProp.relatedLimetype as string;

        if (!relatedLimetype) {
            Logger.warn(`No relatedLimetype found for ${relationProp.name}`);
            continue;
        }

        const relatedPropertiesResponse = await getProperties(
            this,
            relatedLimetype
        );
        if (!relatedPropertiesResponse.success) continue;

        const relationDisplayName =
            (relationProp.localname as string) || (relationProp.name as string);

        const options = relatedPropertiesResponse.data
            .filter((p) => p.type !== 'hasmany')
            .map((p) => ({
                name: `${relationDisplayName} → ${(p.localname as string) || (p.name as string)}`,
                value: `${relationProp.name}.${p.name}`,
                description: `Lookup ${relationDisplayName} by ${p.name} (${p.type})`,
            }));

        allOptions.push(...options);
    }

    const emptyOption: INodePropertyOptions = {
        name: '(None - not a relation field)',
        value: '',
        description: 'Leave empty if this field is not a relation',
    };

    return [
        emptyOption,
        ...allOptions.sort((a, b) => a.name.localeCompare(b.name)),
    ];
}
