import type { Profile } from './storage';

export { CredentialsProvider, useCredentials } from './CredentialsProvider';
export type { Profile, ProfileInput } from './storage';

/** Логин и пароль, которые подставляются в форму входа. */
export type Credentials = Pick<Profile, 'login' | 'password'>;
