import { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { getLimetypesFromApi } from '../transport';

/**
 * Search available Limetypes for a `resourceLocator` list mode.
 *
 * @param filter - Optional text to filter Limetypes by their display name
 * @returns Matching Limetypes as resource locator search results
 *
 * @public
 * @group List Search Methods
 */
export async function searchLimetypes(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await getLimetypesFromApi(this);
	if (!response.success) return { results: [] };

	const results = response.data
		.map((limetype) => ({
			name: limetype.localname?.singular || limetype.name,
			value: limetype.name,
		}))
		.filter((item) => (filter ? item.name.toLowerCase().includes(filter.toLowerCase()) : true))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { results };
}
