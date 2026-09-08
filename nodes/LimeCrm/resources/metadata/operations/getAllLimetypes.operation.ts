import { IExecuteFunctions } from 'n8n-workflow';

import { getLimetypesFromApi } from '../../../transport';
import { Limetype } from '../../../models';
import { WorkflowResponse } from '../../../../response';

/**
 * Description and metadata for the "Get All Limetypes" operation in Lime CRM.
 */
export const description = {
	name: 'Get All Limetypes',
	value: 'getAllLimetypes',
	description: 'Get a list of all available Limetypes',
	action: 'Get all Limetypes',
};

/**
 * Retrieve a list of all available Limetypes from Lime CRM.
 *
 * This operation queries the Lime CRM API for all accessible Limetypes,
 * such as company, person, deal, etc.
 *
 * @returns An array of Limetype objects
 *
 * @public
 */
export async function execute(this: IExecuteFunctions): Promise<WorkflowResponse<Limetype[]>> {
	const response = await getLimetypesFromApi(this);
	return response.data;
}
