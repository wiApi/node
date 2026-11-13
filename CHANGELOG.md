# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-13

### Added
- `pairing.failed` / `pairing.succeeded` events: `PairingFailedData` (`method`, `reason`, `at`), `PairingSucceededData`, the `PairingFailedReason` union and the `PAIRING_FAILURE_REASONS` list; `onPairingFailed` and `onPairingSucceeded` are typed with them. `reason` stays open to values a newer server adds, so treat an unknown one like `error`
- `disconnected` event: `DisconnectedData` (`reason`, always-present `willReconnect`, `resume`, `code`, `detail`, `expireSeconds`, `retryAfterSeconds`), the `DisconnectReason` union and the `DISCONNECT_REASONS` list; `onDisconnected` is typed with it. `reason` stays open to values a newer server adds, so decide by `willReconnect` when you do not know it
- `verifyWebhook(rawBody, headers, secret, { toleranceSeconds })`: verifies `x-wi-signature-v2` (HMAC of `<t>.<body>`) with replay protection (default tolerance 300 s); falls back to the legacy `x-wi-signature` only when no v2 header is sent
- `receipt` event: `ReceiptData` / `ReceiptStatus` types, `KnownWebhookEvent` discriminated union and an `onReceipt` handler

### Changed
- `createWebhookHandler` verifies with `verifyWebhook` and accepts `toleranceSeconds`

### Fixed
- TypeScript resolves the package types under `moduleResolution: "bundler"`, `"node16"` and `"nodenext"`: `exports` lists `types` first for `import` (`index.d.ts`) and `require` (`index.d.cts`). Before, the `types` condition came last and was never used

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
