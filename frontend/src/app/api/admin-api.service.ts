import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

type Maybe<T> = T | null | undefined;


interface GetAllUsersData {
     id :  number;
    name :  string | null;
    role :  string;
    email :  string;
    avatarUrl :  string | null;
    picture :  string | null;
    isActive : boolean;
}


interface GetAllUsersResponse {
  users: GetAllUsersData[];
}


const GET_ALL_USERS_QUERY = gql`
  query GetAllUsers {
    users {
      id
      name
      role
      email
      avatarUrl
      picture
      isActive
    }
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
}
