import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { getLimetypesFromApi } from '../transport';

/**
 * Load available Limetypes from the API
 *
 * @returns Array of Limetypes options
 *
 * @public
 * @group Load Options Methods
 */
export async function getLimetypes(
    this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
    const data: INodePropertyOptions[] = [];
    const response = await getLimetypesFromApi(this);
    if (!response.success) return [];

    for (const limetype of response.data) {
        data.push({
            name: limetype.localname?.singular || limetype.name,
            value: limetype.name,
            description: limetype.name,
        });
    }
    return data.sort((a, b) => a.name.localeCompare(b.name));
}
