# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-03

### Added
- Comprehensive test suite with 57 unit tests covering client lifecycle, message sending, and webhooks
- Injectable `fetch` interface for test mocking without global state pollution
- Full HMAC-SHA256 signature verification tests

### Fixed
- Corrected repository and bug tracker URLs to point to `wiApi/node`
- Standardized package metadata and npm registry links

## [0.1.0] - 2026-09-03

### Added
- Initial release of the official wi-api Node.js SDK
- Support for session management (connect, QR, pair-phone, disconnect, logout)
- Message dispatching for text, image, audio, video, document, location, contact, poll, sticker, reaction
- Webhook verification utilities and framework adapters
