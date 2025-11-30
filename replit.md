# AudioForge Audio Editor

## Overview

AudioForge is a web-based audio editor specifically designed for audiobook editing, built with a full-stack TypeScript architecture. The application provides a digital audio workstation (DAW) interface for editing and manipulating audio files, featuring multi-track editing, high-performance waveform visualization, and audio processing capabilities. The system is designed as a professional-grade audio editing tool with real-time playback, drag-and-drop functionality, and project management features optimized for long-form audio content like audiobooks.

## Recent Architecture Changes (Last 3 Days)

### Waveform Visualization Optimization
- **Removed spectrogram functionality** completely due to performance issues with FFT calculations on large audio files
- **Implemented 3-level caching system** for waveform data (low/medium/high detail) to eliminate recalculation on zoom changes
- **Enhanced waveform rendering** with 60% amplitude boost, brighter blue gradients, and improved peak detection for better visibility
- **Fixed scaling issues** with long audio files (30+ minutes) at high zoom levels (1000%+)

### Audio Engine Architecture Improvements
- **Centralized Audio Engine instance sharing** through prop chain: Editor → Timeline → WaveformCanvas → WaveformVisualization
- **Eliminated duplicate Audio Engine instances** that were causing performance and synchronization issues
- **Implemented getAudioBuffer prop pattern** for reliable audio buffer access across components

### Performance Optimizations
- **Asynchronous waveform processing** to prevent UI blocking during large file analysis
- **Multi-resolution waveform data** cached per audio file for instant zoom level changes
- **Efficient memory management** with optimized sampling rates for different zoom levels

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React 18 and TypeScript, using Vite as the build tool for fast development and optimized production builds. The UI framework leverages Radix UI components with shadcn/ui styling, providing a consistent and accessible component library. TailwindCSS handles the styling with CSS variables for theming support. The routing is managed by Wouter for lightweight client-side navigation.

State management is handled through React Query (TanStack Query) for server state and React hooks for local component state. The audio engine is implemented using the Web Audio API, providing low-level audio processing capabilities directly in the browser. Custom hooks encapsulate audio functionality and provide clean separation of concerns.

#### Waveform Visualization System
The waveform visualization system has been completely redesigned for performance:

- **WaveformVisualization Component** (`client/src/components/audio-editor/waveform-visualization.tsx`)
  - Multi-resolution caching system with 3 detail levels
  - Asynchronous processing pipeline for large audio files
  - Optimized rendering with enhanced visual contrast
  - Real-time zoom adaptation without recalculation

- **Audio Buffer Management** 
  - Centralized through shared Audio Engine instance
  - Props-based buffer sharing prevents duplicate loading
  - Fallback system to LocalAudioStorage when needed

- **Performance Characteristics**
  - Handles 30+ minute audio files at 1000%+ zoom levels
  - Sub-second zoom level changes after initial processing
  - Memory-efficient multi-resolution data storage

### Backend Architecture
The server-side uses Express.js with TypeScript for the REST API implementation. The architecture follows a layered approach with separate concerns for routing, business logic, and data storage. File uploads are handled through Multer middleware with proper validation and temporary storage management.

The storage layer is designed with an interface-based approach (IStorage), allowing for different storage implementations. Currently, it includes an in-memory storage implementation with plans for database integration. The API follows RESTful conventions for audio file management and project operations.

### Data Storage Solutions
The application uses a dual storage approach: file system storage for audio files and database storage for metadata. Audio files are stored in an uploads directory with proper file validation and size limits. The database schema is defined using Drizzle ORM with PostgreSQL as the target database, providing type-safe database operations and migrations.

The schema includes tables for audio files (storing metadata like duration, file paths, and MIME types) and projects (storing timeline data, track configurations, and settings as JSON). The database configuration supports Neon Database as the PostgreSQL provider.

### Authentication and Authorization
The current implementation includes session management infrastructure with connect-pg-simple for PostgreSQL session storage, though specific authentication mechanisms are not yet implemented. The architecture is prepared for user-based access control and project ownership management.

### External Service Integrations

#### Dual TTS Provider Support
The application supports two Text-to-Speech providers with user-selectable choice during import:

**Transkriptor TTS API** (Default)
- **27 Polish voices** (Adrian, Alicja, Andrzej, Aneta, Artur, Beata, Dariusz, Dominika, Elżbieta, Ewa, Grzegorz, Joanna, Justyna, Maciej, Magdalena, Marcin, Mariusz, Małgorzata, Michał, Monika, Natalia, Paulina, Paweł, Piotr, Sebastian, Tomasz, Łukasz)
- **14 emotion/style options** (Angry, Calm, Cheerful, Conversational, Dramatic, Emotional, Formal, Instructional, Narrative, Newcast, Promo, Robotic, Sorrowful, Terrified)
- **Server-side API key management** - key stored in TRANSKRIPTOR_API_KEY environment variable
- **Per-fragment voice and emotion control** - each text fragment can have different voice and style
- **Dialog mode** - automatic speaker detection for "Name: text" format with per-speaker voice/emotion assignment
- **Global emotion setting** - apply same style to all fragments at once
- **Retry logic** - exponential backoff (3 attempts, 2s/4s/6s delays) for API failures
- **Rate limiting** - 2-second delay between fragment requests

**OpenAI TTS API**
- **6 voices** (alloy, echo, fable, onyx, nova, shimmer) - 3 male, 2 female, 1 neutral
- **No emotion support** - UI hides emotion selectors when OpenAI is selected
- **Server-side API key management** - key stored in OPENAI_API_KEY environment variable
- **High-quality output** - uses tts-1-hd model
- **MP3 format** - standard audio format for compatibility

**TTS Implementation Details**
- Provider selection in TTS Import dialog at top of form
- Voice lists dynamically switch based on selected provider
- Gender labels: M (male), K (female), N (neutral - OpenAI only)
- Backend endpoints: `/api/tts/generate` (Transkriptor), `/api/tts/generate/openai` (OpenAI)

#### Neon Database
The application integrates with Neon Database as the primary PostgreSQL provider for production deployments. The database connection is configured through environment variables for secure credential management. The system includes error handling and connection validation to ensure robust database connectivity.

Development tools include Replit-specific plugins for enhanced development experience, including runtime error overlays and cartographer integration for debugging. The Vite configuration includes hot module replacement and development-specific optimizations.

## Key File Descriptions for Developers

### Core Audio Components

**`client/src/components/audio-editor/waveform-visualization.tsx`**
- **Purpose**: High-performance waveform rendering with multi-resolution caching
- **Key Features**: 
  - 3-level detail caching (low: 1/1000 samples, medium: 1/200 samples, high: 1/50 samples)
  - Asynchronous processing with loading states
  - Zoom-adaptive rendering without recalculation
  - Enhanced visual contrast with bright blue gradients
- **Performance**: Optimized for 30+ minute audio files at high zoom levels
- **Dependencies**: Audio buffer from shared Audio Engine instance

**`client/src/components/audio-editor/timeline.tsx`**
- **Purpose**: Main timeline interface with track management and zoom controls
- **Key Features**: 
  - Centralized zoom level management (zoomLevel state)
  - Track creation and management
  - Audio clip positioning and duration controls
  - Integration with WaveformCanvas for visualization
- **Architecture**: Props-based audio buffer sharing to child components
- **Recent Changes**: Removed spectrogram toggle, simplified toolbar

**`client/src/components/audio-editor/waveform-canvas.tsx`**
- **Purpose**: Canvas-based waveform rendering with interaction handling
- **Key Features**: 
  - Clip positioning and resizing
  - Track-level waveform visualization
  - Mouse interaction for selection and dragging
  - Integration with WaveformVisualization component
- **Props Flow**: Receives getAudioBuffer from Timeline, passes to WaveformVisualization

**`client/src/lib/audio-engine.ts`**
- **Purpose**: Core Web Audio API wrapper for audio processing
- **Key Features**: 
  - AudioContext management
  - Track-level gain and pan controls
  - Real-time playback with timeline synchronization
  - Audio buffer loading and management
- **Architecture**: Singleton pattern with shared instance across components

**`client/src/hooks/use-audio-engine.tsx`**
- **Purpose**: React hook wrapper for Audio Engine functionality
- **Key Features**: 
  - Component-level Audio Engine integration
  - State management for playback controls
  - Audio buffer access methods (getAudioBuffer)
  - Timeline synchronization hooks

### Data Management

**`client/src/hooks/use-local-audio-storage.tsx`**
- **Purpose**: Local storage management for audio files and metadata
- **Key Features**: 
  - File upload and storage handling
  - Audio buffer caching
  - Metadata persistence
  - Integration with Audio Engine for buffer sharing

### Removed Components (No Longer in Codebase)

**`client/src/lib/spectrogram-analyzer.ts`** ❌ **REMOVED**
- **Reason**: Performance issues with FFT calculations on large files
- **Replacement**: Enhanced waveform visualization with better contrast

**`client/src/components/audio-editor/view-mode-toggle.tsx`** ❌ **REMOVED**
- **Reason**: No longer needed after spectrogram removal
- **Impact**: Simplified toolbar interface

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

## Performance Considerations

### Waveform Rendering Optimizations
- **Multi-resolution caching**: Prevents expensive recalculations on zoom changes
- **Asynchronous processing**: Large file analysis doesn't block UI
- **Memory efficiency**: Optimized sampling reduces memory footprint for long audio files
- **Zoom-adaptive detail**: Higher detail only when needed at high zoom levels

### Audio Engine Optimizations
- **Shared instance pattern**: Eliminates duplicate Audio Engine instances
- **Props-based buffer sharing**: Reliable buffer access without storage redundancy
- **Lazy loading**: Audio buffers loaded only when needed

### Known Limitations
- Hot module reload resets LocalAudioStorage state during development
- Cache clearing needed when switching between very different audio file sizes
- Maximum zoom level capped at 1500% for performance reasons

The system is designed to be self-contained with minimal external API dependencies, focusing on client-side audio processing capabilities while maintaining robust data persistence through the PostgreSQL database. The recent performance optimizations specifically target audiobook editing workflows with long-form content.