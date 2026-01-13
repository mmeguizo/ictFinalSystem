import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

type Maybe<T> = T | null | undefined;

interface UserSummary {
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

interface UpdateProfileInput {
  name?: string | null;
  avatarDataUrl?: string | null;
}

interface UpdateMyProfileData {
  updateMyProfile: UserSummary;
}

interface UpdateMyProfileVariables {
  input: UpdateProfileInput;
}

interface SetMyPasswordData {
  setMyPassword: { id: number };
}

interface SetMyPasswordVariables {
  password: string;
}

interface MeUser {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  avatarUrl: string | null;
}

interface MeData {
  me: MeUser | null;
}

const UPDATE_MY_PROFILE_MUTATION = gql`
  mutation UpdateMyProfile($input: UpdateProfileInput!) {
    updateMyProfile(input: $input) {
      id
      name
      avatarUrl
    }
  }
`;

const SET_MY_PASSWORD_MUTATION = gql`
  mutation SetMyPassword($password: String!) {
    setMyPassword(password: $password) {
      id
    }
  }
`;

const GET_ME_QUERY = gql`
  query GetMe {
    me {
      id
      email
      name
      role
      avatarUrl
      picture
    }
  }
`;

function getStoredToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('auth_token') || undefined;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly apollo = inject(Apollo);

  updateMyProfile(name: Maybe<string>, avatarDataUrl: Maybe<string>, token?: string) {
    const variables: UpdateMyProfileVariables = {
      input: createUpdateProfileInput(name, avatarDataUrl),
    };
    // console.log('[UserApiService] updateMyProfile variables', {
    //   name: variables.input.name,
    //   hasAvatar: Boolean(variables.input.avatarDataUrl),
    //   avatarBytes: variables.input.avatarDataUrl?.length ?? 0,
    // });

    const authToken = token || getStoredToken();
    return this.apollo.mutate<UpdateMyProfileData, UpdateMyProfileVariables>({
      mutation: UPDATE_MY_PROFILE_MUTATION,
      variables,
      context: buildAuthContext(authToken),
    });
  }

  setMyPassword(password: string, token?: string) {
    // console.log('[UserApiService] setMyPassword variables', { passwordLength: password?.length ?? 0 });
    const authToken = token || getStoredToken();
    return this.apollo.mutate<SetMyPasswordData, SetMyPasswordVariables>({
      mutation: SET_MY_PASSWORD_MUTATION,
      variables: { password },
      context: buildAuthContext(authToken),
    });
  }

  getMe(token?: string) {
    // console.log('[UserApiService] getMe called');
    const authToken = token || getStoredToken();
    return this.apollo.query<MeData, Record<string, never>>({
      query: GET_ME_QUERY,
      fetchPolicy: 'network-only',
      context: buildAuthContext(authToken),
    });
  }
}

function createUpdateProfileInput(name: Maybe<string>, avatarDataUrl: Maybe<string>): UpdateProfileInput {
  const input: UpdateProfileInput = {};

  if (hasValue(name)) {
    input.name = name ?? null;
  }

  if (shouldSendAvatar(avatarDataUrl)) {
    input.avatarDataUrl = avatarDataUrl ?? null;
  }

  return input;
}

function hasValue(value: Maybe<string>): value is string | null {
  return value !== undefined;
}

function shouldSendAvatar(value: Maybe<string>): value is string | null {
  if (!hasValue(value)) {
    return false;
  }
  if (value === null) {
    return true;
  }
  return value.trim().startsWith('data:');
}

function buildAuthContext(token?: string) {
  if (!token) {
    // console.log('[buildAuthContext] No token provided');
    return undefined;
  }
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  // console.log('[buildAuthContext] Headers created with token:', token.substring(0, 20) + '...');
  // console.log('[buildAuthContext] Authorization header:', headers.get('Authorization')?.substring(0, 30) + '...');
  return {
    headers,
  };
}
