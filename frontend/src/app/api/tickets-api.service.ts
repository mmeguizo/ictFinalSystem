import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';


interface Ticket {
  id: number;
  status: string;
}

const APPROVE_SECRETARY_MUTATION = gql`
  mutation approveAsSecretary($ticketId: Ticket) {
    approveAsSecretary(ticketId: $ticketId) {
      id
      status
    }
`;


const APPROVE_DIRECTOR_MUTATION = gql`
  mutation approveAsDirector($ticketId: Ticket) {
    approveAsDirector(ticketId: $ticketId) {
      id
      status
    }
`;
