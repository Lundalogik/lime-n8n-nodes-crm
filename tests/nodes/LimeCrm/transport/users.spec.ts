jest.mock('../../../../nodes/LimeCrm/transport/limetypes', () => ({
	getLimetypesFromApi: jest.fn(),
}));
jest.mock('../../../../nodes/LimeCrm/transport/limeQuery', () => ({
	queryLimeobjects: jest.fn(),
}));
jest.mock('../../../../nodes/LimeCrm/transport/limeobjects', () => ({
	getLimeobject: jest.fn(),
}));

import { NodeApiError } from 'n8n-workflow';
import * as commons from '../../../../nodes/LimeCrm/transport/commons';
import { getLimetypesFromApi } from '../../../../nodes/LimeCrm/transport/limetypes';
import { queryLimeobjects } from '../../../../nodes/LimeCrm/transport/limeQuery';
import { getLimeobject } from '../../../../nodes/LimeCrm/transport/limeobjects';
import {
	fetchManyUsers,
	fetchSingleUserById,
	fetchSingleUserByLimeobjectId,
} from '../../../../nodes/LimeCrm/transport/users';
import { makeNodeExecuteContext } from '../helpers';

const callLimeApiMock = jest.spyOn(commons, 'callLimeApi') as unknown as jest.Mock;
const getLimetypesMock = getLimetypesFromApi as jest.Mock;
const queryMock = queryLimeobjects as jest.Mock;
const getLimeobjectMock = getLimeobject as jest.Mock;

const ok = <T>(data: T) => ({ success: true, data });

const coworkerLimetype = {
	name: 'coworker',
	properties: [
		{ name: 'name', type: 'string' },
		{ name: 'user', type: 'user' },
		{ name: 'deals', type: 'hasmany' },
	],
};
const companyLimetype = {
	name: 'company',
	properties: [{ name: 'name', type: 'string' }],
};

const ctx = makeNodeExecuteContext({});

beforeEach(() => {
	jest.clearAllMocks();
});

describe('fetchManyUsers', () => {
	it('omits empty filters from the query parameters', async () => {
		callLimeApiMock.mockResolvedValue(ok([]));

		await fetchManyUsers(ctx);

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: 'api/v1/admin/users/',
			requestOptions: { qs: { _limit: 50 } },
		});
	});

	it('includes active and user_type filters when set (including active=false)', async () => {
		callLimeApiMock.mockResolvedValue(ok([]));

		await fetchManyUsers(ctx, false, 'STANDARD', 10);

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: 'api/v1/admin/users/',
			requestOptions: {
				qs: { _limit: 10, active: false, user_type: 'STANDARD' },
			},
		});
	});

	it('resolves and attaches coworker data to each user', async () => {
		callLimeApiMock.mockResolvedValue(
			ok([
				{ id: 1, username: 'jane' },
				{ id: 2, username: 'joe' },
			]),
		);
		getLimetypesMock.mockResolvedValue(ok([companyLimetype, coworkerLimetype]));
		queryMock
			.mockResolvedValueOnce(ok({ objects: [{ _id: 7, name: 'Jane' }] }))
			.mockResolvedValueOnce(ok({ objects: [] }));

		const response = await fetchManyUsers(ctx, '', '', 50, true);

		// The coworker query targets the limetype whose properties include
		// one of type 'user', excludes hasmany properties from the response
		// format, and filters on the user property.
		expect(JSON.parse(queryMock.mock.calls[0][1])).toEqual({
			limetype: 'coworker',
			responseFormat: { object: { name: '', user: '' } },
			filter: { key: 'user', op: '=', exp: 1 },
		});
		// A user without a matching coworker object gets null.
		expect(response).toEqual(
			ok([
				{
					id: 1,
					username: 'jane',
					coworker: { _id: 7, name: 'Jane' },
				},
				{ id: 2, username: 'joe', coworker: null },
			]),
		);
	});

	it('throws when no limetype has a user property', async () => {
		callLimeApiMock.mockResolvedValue(ok([{ id: 1 }]));
		getLimetypesMock.mockResolvedValue(ok([companyLimetype]));

		await expect(fetchManyUsers(ctx, '', '', 50, true)).rejects.toThrow(NodeApiError);
	});

	it('returns an error envelope instead when errors continue', async () => {
		callLimeApiMock.mockResolvedValue(ok([{ id: 1 }]));
		getLimetypesMock.mockResolvedValue(ok([companyLimetype]));
		const continueCtx = makeNodeExecuteContext({}, { onError: 'continueRegularOutput' });

		const response = await fetchManyUsers(continueCtx, '', '', 50, true);

		expect(response).toEqual({
			success: false,
			data: {
				error: {
					message: "No limetype with 'user' property found to get coworker",
				},
			},
		});
	});
});

describe('fetchSingleUserById', () => {
	it('fetches the user by id with error metadata', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 42, username: 'jane' }));

		const response = await fetchSingleUserById(ctx, '42');

		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: 'api/v1/admin/users/42',
			errorMetadata: { user_id: '42' },
		});
		expect(response).toEqual(ok({ id: 42, username: 'jane' }));
	});

	it('attaches coworker data to the user when requested', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 42, username: 'jane' }));
		getLimetypesMock.mockResolvedValue(ok([coworkerLimetype]));
		queryMock.mockResolvedValue(ok({ objects: [{ _id: 7 }] }));

		const response = await fetchSingleUserById(ctx, '42', true);

		expect(response).toEqual(ok({ id: 42, username: 'jane', coworker: { _id: 7 } }));
	});

	it('attaches null when the user has no matching coworker object', async () => {
		callLimeApiMock.mockResolvedValue(ok({ id: 42, username: 'jane' }));
		getLimetypesMock.mockResolvedValue(ok([coworkerLimetype]));
		queryMock.mockResolvedValue(ok({ objects: [] }));

		const response = await fetchSingleUserById(ctx, '42', true);

		expect(response).toEqual(ok({ id: 42, username: 'jane', coworker: null }));
	});
});

describe('fetchSingleUserByLimeobjectId', () => {
	it('resolves the user id from the coworker limeobject', async () => {
		getLimetypesMock.mockResolvedValue(ok([coworkerLimetype]));
		getLimeobjectMock.mockResolvedValue(ok({ _id: 7, name: 'Jane', user: 101 }));
		callLimeApiMock.mockResolvedValue(ok({ id: 101, username: 'jane' }));

		const response = await fetchSingleUserByLimeobjectId(ctx, '7');

		expect(getLimeobjectMock).toHaveBeenCalledWith(ctx, 'coworker', '7');
		// The user is fetched by the value of the coworker's user property.
		expect(callLimeApiMock).toHaveBeenCalledWith(ctx, {
			method: 'GET',
			url: 'api/v1/admin/users/101',
			errorMetadata: { user_id: '7' },
		});
		expect(response).toEqual(ok({ id: 101, username: 'jane' }));
	});

	it('attaches the coworker limeobject to the user data when requested', async () => {
		getLimetypesMock.mockResolvedValue(ok([coworkerLimetype]));
		getLimeobjectMock.mockResolvedValue(ok({ _id: 7, name: 'Jane', user: 101 }));
		callLimeApiMock.mockResolvedValue(ok({ id: 101, username: 'jane' }));

		const response = await fetchSingleUserByLimeobjectId(ctx, '7', true);

		expect(response).toEqual(
			ok({
				id: 101,
				username: 'jane',
				coworker: { _id: 7, name: 'Jane', user: 101 },
			}),
		);
	});

	it('passes a failed limeobject lookup through unchanged', async () => {
		getLimetypesMock.mockResolvedValue(ok([coworkerLimetype]));
		const errorEnvelope = {
			success: false,
			data: { error: { message: 'not found' } },
		};
		getLimeobjectMock.mockResolvedValue(errorEnvelope);

		const response = await fetchSingleUserByLimeobjectId(ctx, '7');

		expect(response).toBe(errorEnvelope);
		expect(callLimeApiMock).not.toHaveBeenCalled();
	});
});
