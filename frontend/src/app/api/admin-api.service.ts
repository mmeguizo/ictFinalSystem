import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

export interface UserData {
  id: number;
  name: string | null;
  role: string;
  email: string;
  avatarUrl: string | null;
  picture: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  externalId: string | null;
}

interface GetAllUsersResponse {
  users: UserData[];
}

interface CreateUserResponse {
  createUser: UserData;
}

interface SetUserRoleResponse {
  setUserRole: UserData;
}

interface SetLocalPasswordResponse {
  setLocalPassword: UserData;
}

interface ToggleUserActiveResponse {
  toggleUserActive: UserData;
}

interface DeleteUserResponse {
  deleteUser: boolean;
}

const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    role
    email
    avatarUrl
    picture
    isActive
    createdAt
    lastLoginAt
    externalId
  }
`;

const GET_ALL_USERS_QUERY = gql`
  query GetAllUsers {
    users {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

const CREATE_USER_MUTATION = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

const SET_USER_ROLE_MUTATION = gql`
  mutation SetUserRole($id: Int!, $role: Role!) {
    setUserRole(id: $id, role: $role) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

const SET_LOCAL_PASSWORD_MUTATION = gql`
  mutation SetLocalPassword($id: Int!, $password: String!) {
    setLocalPassword(id: $id, password: $password) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

const TOGGLE_USER_ACTIVE_MUTATION = gql`
  mutation ToggleUserActive($id: Int!) {
    toggleUserActive(id: $id) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($id: Int!) {
    deleteUser(id: $id)
  }
`;

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly apollo = inject(Apollo);

  getAllUsers() {
    return this.apollo.query<GetAllUsersResponse>({
      query: GET_ALL_USERS_QUERY,
      fetchPolicy: 'network-only',
    });
  }

  createUser(input: { email: string; name?: string; password?: string; role: string }) {
    return this.apollo.mutate<CreateUserResponse>({
      mutation: CREATE_USER_MUTATION,
      variables: { input },
    });
  }

  setUserRole(id: number, role: string) {
    return this.apollo.mutate<SetUserRoleResponse>({
      mutation: SET_USER_ROLE_MUTATION,
      variables: { id, role },
    });
  }

  setLocalPassword(id: number, password: string) {
    return this.apollo.mutate<SetLocalPasswordResponse>({
      mutation: SET_LOCAL_PASSWORD_MUTATION,
      variables: { id, password },
    });
  }

  toggleUserActive(id: number) {
    return this.apollo.mutate<ToggleUserActiveResponse>({
      mutation: TOGGLE_USER_ACTIVE_MUTATION,
      variables: { id },
    });
  }

  deleteUser(id: number) {
    return this.apollo.mutate<DeleteUserResponse>({
      mutation: DELETE_USER_MUTATION,
      variables: { id },
    });
  }
}
