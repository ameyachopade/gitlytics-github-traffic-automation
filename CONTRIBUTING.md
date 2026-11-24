# Contributing to Gitlytics Traffic Sync Automation

Thank you for contributing to the **Gitlytics Ecosystem**. This repository provides the official composite GitHub Action (`ameyachopade/gitlytics-github-traffic-automation`) and template workflow that snapshots GitHub traffic on the 1st, 8th, 15th, and 22nd of each month.

## Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/ameyachopade/gitlytics-github-traffic-automation.git
   cd gitlytics-github-traffic-automation
   ```
2. Create a virtual environment and install test requirements (Python 3.11+):
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/your-change
   ```

## Local Verification

Run the action contract and workflow test suite before opening a pull request:

```bash
python -m pytest -q
```

## Standards & Guardrails

- **Pin External Actions by Full Commit SHA**: Every `uses:` step in `action.yml` and `.github/workflows/` must pin a full 40-character commit SHA with a version comment (never a moving branch).
- **No Shell Injection**: Never interpolate `${{ inputs.* }}` or `${{ steps.* }}` directly inside a `run:` script body; pass them through `env:` and quote variables.
- **Least-Privilege Permissions**: Document and require **Administration: Read** and **Metadata: Read** for fine-grained PATs (never Administration: Write). Keep `include_private: 'false'` by default.
- **Zero Secrets**: Never commit `.env` files, GitHub PATs, or private repository CSV archives.
- **Security Issues**: Follow [SECURITY.md](SECURITY.md) and report vulnerabilities privately.

## Pull Request Checklist

- [ ] Tests pass locally (`python -m pytest -q`)
- [ ] All workflow/action pins remain SHA-pinned and injection-safe
- [ ] `README.md` inputs/outputs match `action.yml`
- [ ] No secrets or personal traffic CSVs are staged

## The Gitlytics Ecosystem

| Project | Role | Link |
| :--- | :--- | :--- |
| [gitlytics](https://github.com/ameyachopade/gitlytics) | Core Python library, CLI, local stdio MCP & local dashboard | [PyPI](https://pypi.org/project/gitlytics) |
| [gitlytics-plugin](https://github.com/ameyachopade/gitlytics-plugin) | Official Antigravity plugin, MCP config & 4 `npx skills` | [skills.sh](https://skills.sh/ameyachopade/gitlytics-plugin) |
| [gitlytics-github-traffic-automation](https://github.com/ameyachopade/gitlytics-github-traffic-automation) *(this repo)* | Composite GitHub Action for automated CSV backups | [GitHub Action](https://github.com/ameyachopade/gitlytics-github-traffic-automation) |
| **Gitlytics Web & Docs** | Homepage, Docs Hub & Engineering Blog | [gitlytics.dev](https://gitlytics.dev) / [docs.gitlytics.dev](https://docs.gitlytics.dev) / [blog.gitlytics.dev](https://blog.gitlytics.dev) |
| Gitlytics Cloud Dashboard & API | Hosted Analytics Dashboard, SVG Engine & MCP Server | [dashboard.gitlytics.dev](https://dashboard.gitlytics.dev) / [api.gitlytics.dev](https://api.gitlytics.dev) |
