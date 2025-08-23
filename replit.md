# AudioForge Audio Editor

## Overview

AudioForge is a web-based audio editor built with a full-stack TypeScript architecture. The application provides a digital audio workstation (DAW) interface for editing and manipulating audio files, featuring multi-track editing, waveform visualization, and audio processing capabilities. The system is designed as a professional-grade audio editing tool with real-time playback, drag-and-drop functionality, and project management features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React 18 and TypeScript, using Vite as the build tool for fast development and optimized production builds. The UI framework leverages Radix UI components with shadcn/ui styling, providing a consistent and accessible component library. TailwindCSS handles the styling with CSS variables for theming support. The routing is managed by Wouter for lightweight client-side navigation.

State management is handled through React Query (TanStack Query) for server state and React hooks for local component state. The audio engine is implemented using the Web Audio API, providing low-level audio processing capabilities directly in the browser. Custom hooks encapsulate audio functionality and provide clean separation of concerns.

### Backend Architecture
The server-side uses Express.js with TypeScript for the REST API implementation. The architecture follows a layered approach with separate concerns for routing, business logic, and data storage. File uploads are handled through Multer middleware with proper validation and temporary storage management.

The storage layer is designed with an interface-based approach (IStorage), allowing for different storage implementations. Currently, it includes an in-memory storage implementation with plans for database integration. The API follows RESTful conventions for audio file management and project operations.

### Data Storage Solutions
The application uses a dual storage approach: file system storage for audio files and database storage for metadata. Audio files are stored in an uploads directory with proper file validation and size limits. The database schema is defined using Drizzle ORM with PostgreSQL as the target database, providing type-safe database operations and migrations.

The schema includes tables for audio files (storing metadata like duration, file paths, and MIME types) and projects (storing timeline data, track configurations, and settings as JSON). The database configuration supports Neon Database as the PostgreSQL provider.

### Authentication and Authorization
The current implementation includes session management infrastructure with connect-pg-simple for PostgreSQL session storage, though specific authentication mechanisms are not yet implemented. The architecture is prepared for user-based access control and project ownership management.

### External Service Integrations
The application integrates with Neon Database as the primary PostgreSQL provider for production deployments. The database connection is configured through environment variables for secure credential management. The system includes error handling and connection validation to ensure robust database connectivity.

Development tools include Replit-specific plugins for enhanced development experience, including runtime error overlays and cartographer integration for debugging. The Vite configuration includes hot module replacement and development-specific optimizations.

## External Dependencies

- **Database**: Neon Database (PostgreSQL) - Serverless PostgreSQL database for storing audio file metadata and project data
- **UI Components**: Radix UI - Provides accessible, unstyled UI primitives for building the audio editor interface
- **Styling**: TailwindCSS - Utility-first CSS framework for consistent styling and theming
- **Audio Processing**: Web Audio API - Browser-native audio processing capabilities for real-time audio manipulation
- **File Upload**: Multer - Express middleware for handling multipart/form-data file uploads
- **ORM**: Drizzle ORM - Type-safe database toolkit for PostgreSQL with migration support
- **Build Tool**: Vite - Fast frontend build tool with TypeScript support and development server
- **State Management**: TanStack Query - Server state management library for API calls and caching
- **Development**: Replit Development Environment - Integrated development platform with custom plugins and utilities

The system is designed to be self-contained with minimal external API dependencies, focusing on client-side audio processing capabilities while maintaining robust data persistence through the PostgreSQL database.