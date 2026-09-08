import { APIResponseValue } from './constants';
import { IncludedProperties } from '../transport';
import { Limeobject } from './limeobject';

/**
 * Available user login types in Lime CRM
 * @public
 * @group Models
 */
type UserLoginType = 'DEFAULT' | 'LIME' | 'LIME_AND_WINDOWS';

/**
 * Available user types in Lime CRM
 * @public
 * @group Models
 */
type UserType =
    | 'STANDARD'
    | 'ADMINISTRATION'
    | 'SERVICE'
    | 'INTEGRATION'
    | 'SYNCHRONIZATION'
    | 'TEST'
    | 'API';

/**
 * Representation of a user returned by the Lime CRM API.
 *
 * @property id - The unique ID of the user
 * @property username - username, most often email address
 * @property active - flag determining whether user is active
 * @property loginType - user login type from Lime CRM
 * @property userType - user type from Lime CRM
 *
 * @public
 * @group Models
 */
type User = {
    id: number;
    username: string;
    active: boolean;
    loginType: UserLoginType;
    userType: UserType;
} & Record<string, APIResponseValue | IncludedProperties | Limeobject>;

export { User, UserType, UserLoginType };
