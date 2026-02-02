# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Base ADS-B source class to eliminate code duplication across OpenSky and ADSBExchange sources
- Service initializer modules for better organization (core, tracking, data-sources, media, audio)
- Centralized WebSocket message type definitions with JSDoc types
- Unified configuration system with clear precedence (runtime > env > defaults)
- Centralized error handling middleware with custom error classes
- Router modules for better code organization (hex-lookup router created)
- Comprehensive JSDoc documentation for better IDE support

### Changed
- Refactored OpenSky source to extend BaseADSBSource (reduced from ~205 to ~130 lines)
- Refactored ADSBExchange source to extend BaseADSBSource (reduced from ~357 to ~245 lines)
- Improved service initialization patterns with dedicated initializer modules
- Standardized error responses across all endpoints

### Fixed
- TAR1090 configuration - enabled TAR1090 with proper URL configuration for local receiver
- Inconsistent error handling across routes
- Code duplication in ADS-B source implementations

## [1.0.0] - 2024-10-21

### Added
- Initial release of AirWave mission control system
- ACARS message monitoring via Airframes.io
- ADS-B aircraft tracking (TAR1090, OpenSky Network, ADS-B Exchange)
- HFGCS monitoring with automatic EAM detection
- ATC audio streaming with Whisper transcription
- Emergency scanner integration (police, fire, EMS)
- Video generation with Remotion for social media
- Twitter/X integration for automated posting
- Aircraft photo caching from Planespotters.net
- SQLite database with full-text search capabilities
- Real-time WebSocket updates with message batching
- SpaceX mission control themed UI built with Next.js and Tailwind CSS
- Winston logging with rotation and sensitive data redaction
- Graceful shutdown handling for all services
- Aviation Data Model v1.0 with JSON schemas
- Comprehensive API for data access and service control

### Features
- Multi-source aircraft tracking with deduplication
- Intelligent flight phase detection
- HFGCS aircraft correlation with civilian ADS-B data
- VOX-based audio recording with silence detection
- YouTube live stream monitoring and recording
- Automatic aircraft registration lookup
- Background photo prefetching for active aircraft
- Database maintenance and optimization tools
- Configurable data retention policies
- Rate limiting on API endpoints
- JWT authentication for admin operations

### Technical Highlights
- Three-tier architecture (backend/frontend/video generation)
- Modular data source system with EventEmitter pattern
- Zustand state management in frontend
- Comprehensive database indexing for performance
- WebSocket batching to reduce frontend load
- Automatic reconnection handling for all data sources
- Sensitive data redaction in logs
- CORS configuration for cross-origin requests

