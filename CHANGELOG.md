# Changelog

Changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CLI checks for required environment variables, readable files and HTTP/HTTPS URLs.
- Explicit dotenv loading with process-value precedence and Windows case handling.
- Optional HTTP probes with status checks, bounded redirects and a shared timeout.
- Text and JSON reports, stable result codes and exit codes 0/1/2.
- Local tarball distribution, Windows/Linux CI, contribution guidance and architecture documentation.

### Fixed

- Inherited environment property names no longer abort checks.
- Null numeric configuration options are rejected.

The package version is 0.1.0; no npm release has been published.
