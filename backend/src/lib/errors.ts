import { GraphQLError } from 'graphql';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toGraphQLError(): GraphQLError {
    return new GraphQLError(this.message, {
      extensions: {
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}

// Error formatter for Apollo Server
export function formatError(error: any): any {
  if (error.originalError instanceof AppError) {
    const appError = error.originalError as AppError;
    return {
      message: appError.message,
      extensions: {
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
      },
    };
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return {
    message: 'Internal server error',
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
    },
  };
}
