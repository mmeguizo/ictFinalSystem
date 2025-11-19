import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

interface LoginData {
  login: {
    token: string;
    user: {
      id: number;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      role: string;
    };
  };
}

interface LoginVariables {
  email: string;
  password: string;
}

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        avatarUrl
        role
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly apollo = inject(Apollo);

  login(email: string, password: string) {
    console.log('[AuthApiService] login attempt for:', email);
    return this.apollo.mutate<LoginData, LoginVariables>({
      mutation: LOGIN_MUTATION,
      variables: { email, password },
    });
  }
}
