# MVC Architecture for DomainCal

This document outlines the Model-View-Controller (MVC) architecture implemented in the DomainCal application.

## Overview

The application has been refactored to follow the MVC pattern for better maintainability and separation of concerns:

- **Models**: Data structures and database interactions
- **Controllers**: Business logic and request handling
- **Services**: Core business logic and data processing
- **Routes**: API endpoints that delegate to controllers

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── domains/
├── components/
├── controllers/
│   ├── auth.controller.ts
│   └── domain.controller.ts
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   └── ...
├── models/
│   ├── domain.model.ts
│   └── user.model.ts
└── services/
    ├── auth.service.ts
    ├── domain.service.ts
    ├── pending-domains.service.ts
    └── domain-lookup.service.ts
```

## Components

### Models

Models represent the data structures and provide serialization/deserialization functions:

- `domain.model.ts`: Defines the Domain model and related interfaces
- `user.model.ts`: Defines the User model and related interfaces

### Services

Services contain the core business logic and database interactions:

- `domain.service.ts`: Handles domain-related operations like fetching, adding, and validating domains
- `auth.service.ts`: Handles authentication-related operations like user registration and login
- `pending-domains.service.ts`: Manages storage and retrieval of pending domains in the browser
- `domain-lookup.service.ts`: Handles domain information lookup and updates

### Controllers

Controllers handle HTTP requests and delegate to services:

- `domain.controller.ts`: Processes domain-related requests and returns appropriate responses
- `auth.controller.ts`: Processes authentication-related requests

### Routes

Routes are API endpoints that delegate to controllers:

- `/api/domains`: Handles domain-related requests
- `/api/auth/register`: Handles user registration
- `/api/auth/login`: Handles user login

## Benefits of MVC Architecture

1. **Separation of Concerns**: Each component has a specific responsibility
2. **Maintainability**: Easier to understand and modify code
3. **Testability**: Components can be tested in isolation
4. **Scalability**: New features can be added without affecting existing code
5. **Code Reuse**: Services can be reused across different controllers

## Future Improvements

1. Add more comprehensive error handling
2. Implement input validation middleware
3. Add unit tests for each component
4. Implement caching for frequently accessed data
5. Add documentation for API endpoints
