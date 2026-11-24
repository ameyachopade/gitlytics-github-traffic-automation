# Security Policy - Gitlytics Traffic Sync Automation

This repository is part of the **Gitlytics Ecosystem** and distributes the official composite GitHub Action (`ameyachopade/gitlytics-github-traffic-automation`) for automated monthly CSV traffic backups.

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `v1.2.x` (latest) | Yes |
| `< v1.2.0` | No |

## Security Controls in `gitlytics-github-traffic-automation`

- **Least-Privilege Token Scope**: Fine-grained PATs require only **Administration: Read** and **Metadata: Read** on the target repositories; write permissions on repository administration are never requested.
- **Private Repo Opt-In**: With `repository: 'all'`, private repositories are excluded by default (`include_private: 'false'`) so private repository names and traffic metrics are never accidentally committed to a public vault.
- **SHA-Pinned Dependencies & Actions**: Workflow steps pin third-party GitHub Actions to immutable 40-character commit SHAs and install a pinned `gitlytics` version.
- **Script Injection Defense**: Action inputs and step outputs are passed via `env:` bindings rather than interpolated directly into `run:` shell scripts.
- **Token Hygiene**: `TRAFFIC_TOKEN` must be stored exclusively in GitHub Actions Secrets and never hardcoded in workflow YAML or committed CSV files.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report vulnerabilities privately using either:
1. GitHub's **Private Vulnerability Reporting** (**Security** tab -> **Advisories** -> **Report a vulnerability**).
2. Email **contact@gitlytics.dev** (or **ameyasanjaychopade@gmail.com**) with `[SECURITY]` in the subject line.

Please include:
- **Affected Component** (`action.yml`, `.github/workflows/`, or helper scripts)
- **Impact & Detailed Description**
- **Steps to Reproduce** or minimal Proof of Concept

## Response SLA

1. **Acknowledgment**: Within 72 hours.
2. **Triage & Investigation**: Severity assessment and root-cause analysis.
3. **Fix & Advisory**: Coordinated patch release and credit (if desired).
