# Overview

This is a comprehensive Rights and Royalties Management application built as a full-stack web application. The system provides contract management, rights availability checking, royalty calculations, and audit trail functionality for managing intellectual property licensing deals. It's designed to serve different user roles (Admin, Legal, Finance, Sales) with role-based access and comprehensive tracking capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Wouter for client-side routing
- **UI Library**: Radix UI components with shadcn/ui design system and Tailwind CSS for styling
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Form Handling**: React Hook Form with Zod schema validation for type-safe form processing
- **File Uploads**: Uppy with Google Cloud Storage integration for contract document uploads

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit-specific OIDC authentication with session management
- **API Design**: RESTful API endpoints with structured error handling and request logging

## Database Design
- **Database**: PostgreSQL (via Neon serverless)
- **Schema Management**: Drizzle migrations with shared schema definitions
- **Key Tables**:
  - Users with role-based access (Admin, Legal, Finance, Sales)
  - Contracts with comprehensive IP licensing details
  - Royalties with calculation tracking
  - Audit logs for activity monitoring
  - Sessions for authentication state

## Authentication & Authorization
- **Provider**: Replit OIDC integration with JWT tokens
- **Session Management**: PostgreSQL-backed session storage with configurable TTL
- **Role-Based Access**: Four-tier role system with different permission levels
- **Security**: HTTP-only cookies, CSRF protection, and secure session handling

## File Storage & Management
- **Storage Provider**: Google Cloud Storage with Replit sidecar integration
- **Upload Strategy**: Direct-to-cloud uploads using presigned URLs
- **Access Control**: Custom ACL system for object-level permissions
- **File Types**: PDF contract documents with metadata tracking

## Development & Build Architecture
- **Build Tool**: Vite for frontend bundling with React plugin
- **Development**: Hot module replacement and development server integration
- **Production**: Express serves static assets with proper caching headers
- **TypeScript**: Unified configuration across client, server, and shared modules

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Replit OIDC service
- **File Storage**: Google Cloud Storage with Replit sidecar proxy
- **Session Store**: PostgreSQL with connect-pg-simple adapter

## Frontend Libraries
- **UI Framework**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with CSS variables for theming
- **File Upload**: Uppy dashboard with AWS S3 compatibility layer
- **Data Fetching**: TanStack Query for caching and synchronization
- **Form Validation**: Zod schemas shared between client and server

## Backend Services
- **Database Driver**: Neon serverless PostgreSQL driver with WebSocket support
- **Object Storage**: Google Cloud Storage client with custom authentication
- **Session Management**: Express-session with PostgreSQL store
- **Validation**: Shared Zod schemas for request/response validation

## Development Tools
- **Type Safety**: TypeScript across the entire stack
- **Code Quality**: Consistent linting and formatting configuration
- **Build Process**: ESBuild for server bundling, Vite for client bundling
- **Database Migrations**: Drizzle Kit for schema management and migrations