# Backend Integration Tests

Integration test suite for the carpaintr backend service using pytest and httpx.

## Quick Start

```bash
cd backend-integration-tests

# Auto-setup (installs uv, creates venv, installs dependencies)
task setup
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Run all tests
task test

# Run with coverage
task test:cov
```

## Features

- ✅ **Auto-setup** - Dependencies install automatically with `task setup`
- ✅ **Smart fixtures** - Reusable auth clients and tokens for all tests
- ✅ **Async/await** - Modern Python async testing with httpx
- ✅ **Task integration** - Run from project root with `task test`
- ✅ **Coverage reports** - HTML reports with `task test:cov`
- ✅ **Fast execution** - ~10 seconds for full test suite

## Prerequisites

- Python 3.11 or higher
- [uv](https://github.com/astral-sh/uv) package manager (auto-checked by Taskfile)
- Backend service running at `http://localhost:8080`

## Common Commands

```bash
task setup             # Setup environment (run once)
task test              # Run all tests
task test:auth         # Auth tests only
task test:admin        # Admin tests only
task test:license      # License tests only
task test:cov          # With coverage report
task check-backend     # Verify backend is running
task clean             # Clean up generated files
task --list            # Show all available tasks
```

## Current Test Coverage

**24 passing tests** covering:
- User registration (valid/invalid data, duplicate emails)
- User login (valid/invalid credentials)
- Admin status checking (admin vs regular users)
- JWT token validation
- Protected endpoint access
- License generation (admin-only, by days, with/without level)
- License cache invalidation (admin-only)

## Documentation

- **[Setup Guide](docs/setup.md)** - Detailed installation and configuration
- **[Authentication Flow](docs/authentication.md)** - Understanding the two-step auth process
- **[Fixtures Reference](docs/fixtures.md)** - Available fixtures and usage examples
- **[Deployment](docs/deployment.md)** - Docker data sync behavior and rsync details

## Project Structure

```
backend-integration-tests/
├── README.md               # This file
├── pyproject.toml          # Project config and dependencies
├── Taskfile.yml            # Task automation
├── .env.example            # Example environment config
├── docs/                   # Detailed documentation
│   ├── setup.md
│   ├── authentication.md
│   ├── fixtures.md
│   └── deployment.md
└── tests/
    ├── conftest.py         # Shared fixtures
    ├── test_auth.py        # Authentication tests
    └── test_license.py     # License management tests
```

## Quick Example

```python
import pytest

@pytest.mark.integration
async def test_my_endpoint(authenticated_client):
    """Test with authenticated user."""
    response = await authenticated_client.get("/user/some_endpoint")
    assert response.status_code == 200
    data = response.json()
    assert "expected_field" in data
```

## Troubleshooting

**Backend not running?**
```bash
task check-backend  # Verify backend is accessible
```

**Authentication failures?**
- Check that `backend-service-rust/admins.txt` contains `test_admin@example.com`
- Verify `.env` configuration matches backend setup

**Need more details?**
- See [Setup Guide](docs/setup.md) for detailed troubleshooting
- Check backend logs for authentication errors

## Additional Resources

- [pytest documentation](https://docs.pytest.org/)
- [httpx documentation](https://www.python-httpx.org/)
- [uv documentation](https://github.com/astral-sh/uv)
