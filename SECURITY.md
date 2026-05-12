# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest release | ✅ |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please:

1. **Do NOT open a public issue**
2. Email: `kevinnft@users.noreply.github.com`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)

We will respond within 48 hours and work with you to resolve the issue.

## Security Practices

- API keys and provider credentials are stored locally only (`~/.local/share/enowx-coder/`)
- No telemetry or data collection
- SQLite database is local-only
- Provider API calls use HTTPS only
- All Rust code uses safe error handling (no `unwrap()` in production paths)
