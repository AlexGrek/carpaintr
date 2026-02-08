# Backend Integration Tests

Integration test suite for the carpaintr backend service using pytest and httpx.

## Prerequisites

- Python 3.11 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- Backend service running at `http://localhost:8080` (or configured URL)

## Installation

### Install uv (if not already installed)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv
```

### Setup the test environment

```bash
cd backend-integration-tests

# Quick setup with Taskfile
task setup
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Or manual setup
uv venv
uv pip install -e ".[dev]"
```

## Configuration

Copy `.env.example` to `.env` and adjust settings if needed:

```bash
cp .env.example .env
```

Configuration options:
- `BACKEND_BASE_URL`: Base URL of the backend service (default: `http://localhost:8080`)
- `TEST_USER_EMAIL`: Email for test user (default: `test_user@example.com`)
- `TEST_USER_PASSWORD`: Password for test user (default: `testpassword123`)
- `TEST_ADMIN_EMAIL`: Email for test admin (default: `test_admin@example.com`)
- `TEST_ADMIN_PASSWORD`: Password for test admin (default: `adminpassword123`)
- `REQUEST_TIMEOUT`: Request timeout in seconds (default: `30`)

**Important:** The test admin email (`test_admin@example.com`) has been added to `backend-service-rust/admins.txt` to ensure admin status.

## Running Tests

### Start the backend service first

```bash
# From the project root
task backend
# or
cd backend-service-rust && cargo run
```

### Check if backend is running

```bash
task check-backend
```

### Run all tests

```bash
task test
# or directly
pytest -v
```

### Run specific test categories

```bash
# Authentication tests only
task test:auth

# Admin tests only
task test:admin

# Integration tests
task test:integration

# Or with pytest directly
pytest -m auth
pytest -m admin
pytest -m integration
```

### Run specific test file

```bash
pytest tests/test_auth.py
```

### Run with coverage

```bash
task test:cov
# or
pytest --cov=tests --cov-report=html
```

### Run tests in parallel

```bash
task test:fast
# or
pytest -n auto
```

### Other useful commands

```bash
task --list           # Show all available tasks
task clean            # Clean up generated files
task clean:all        # Clean everything including venv
```

## Test Structure

```
backend-integration-tests/
├── pyproject.toml          # Project configuration and dependencies
├── .env                    # Environment configuration
├── .env.example            # Example environment configuration
├── README.md               # This file
└── tests/
    ├── __init__.py
    ├── conftest.py         # Shared fixtures and helpers
    └── test_auth.py        # Authentication & admin tests
```

## Fixtures

### Available Fixtures

- **`http_client`**: Unauthenticated async HTTP client
- **`authenticated_client`**: HTTP client with test user token
- **`admin_authenticated_client`**: HTTP client with admin user token
- **`test_user_token`**: JWT token for test user
- **`test_admin_token`**: JWT token for admin user
- **`test_user_credentials`**: Test user email/password dict
- **`test_admin_credentials`**: Test admin email/password dict
- **`base_url`**: API base URL
- **`backend_health_check`**: Ensures backend is running before tests

### Example Usage

```python
async def test_my_endpoint(authenticated_client):
    """Test with authenticated user."""
    response = await authenticated_client.get("/user/some_endpoint")
    assert response.status_code == 200
```

## Backend Authentication Flow

Understanding the backend authentication is crucial for writing tests:

### Registration (Step 1)
**Endpoint:** `POST /api/v1/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "company_name": "Company Name"
}
```

**Response:** `200 OK` with **empty body**
- Note: Registration does NOT return a token
- The user account is created successfully
- You must login separately to get a token

### Login (Step 2)
**Endpoint:** `POST /api/v1/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK` with JSON
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Using Protected Endpoints (Step 3)
**Header:** `Authorization: Bearer <token>`

```python
response = await client.get(
    "/api/v1/user/protected_endpoint",
    headers={"Authorization": f"Bearer {token}"}
)
```

### Admin Routes
Admin status is determined by the `backend-service-rust/admins.txt` file:
- Admin routes: `/api/v1/admin/*`
- Requires both valid JWT token AND email in admins.txt
- Test admin email `test_admin@example.com` is pre-configured

## Test Categories

### Authentication Tests (`test_auth.py`)

- **Registration**: Test user registration with valid/invalid data
- **Login**: Test login with valid/invalid credentials
- **Admin Status**: Test admin status checking for admin/regular users
- **Token Validation**: Test JWT token validation on protected endpoints

## Writing New Tests

1. Create a new test file in `tests/` directory (e.g., `test_calculations.py`)
2. Import required fixtures from conftest
3. Use pytest markers to categorize tests:
   ```python
   @pytest.mark.integration
   @pytest.mark.calculations
   async def test_calculation_endpoint(authenticated_client):
       ...
   ```
4. Use async/await for HTTP requests with httpx

### Example Test

```python
import pytest

@pytest.mark.integration
class TestMyFeature:
    async def test_my_endpoint(
        self,
        authenticated_client,
        backend_health_check,
    ):
        """Test description."""
        response = await authenticated_client.get("/user/my_endpoint")

        assert response.status_code == 200
        data = response.json()
        assert "expected_field" in data
```

## Troubleshooting

### Backend not running

If you see: `Backend server is not running at http://localhost:8080`

Solution: Start the backend service before running tests.

### Authentication failures

If tests fail with 401/403 errors:
1. Check that `admins.txt` contains `test_admin@example.com`
2. Verify `.env` configuration matches expected credentials
3. Check backend logs for authentication errors

### Connection timeout

If tests timeout:
1. Increase `REQUEST_TIMEOUT` in `.env`
2. Check backend service is responsive
3. Check network/firewall settings

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Task
        uses: arduino/setup-task@v1

      - name: Install uv
        run: curl -LsSf https://astral.sh/uv/install.sh | sh

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend-integration-tests
          task setup

      - name: Start backend
        run: |
          cd backend-service-rust
          cargo build --release
          ./target/release/backend-service-rust &
          sleep 5

      - name: Run tests
        run: |
          cd backend-integration-tests
          source .venv/bin/activate
          task test:cov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Summary

### Key Features
- ✅ **Auto-setup** - Dependencies install automatically on first run
- ✅ **Smart fixtures** - Reusable auth clients and tokens
- ✅ **Async/await** - Modern Python async testing with httpx
- ✅ **Task integration** - Run from project root with `task test`
- ✅ **Coverage reports** - HTML reports with `task test:cov`
- ✅ **Fast execution** - ~10 seconds for full test suite

### Current Test Coverage
- **14 passing tests** covering:
  - User registration (with/without validation)
  - User login (valid/invalid credentials)
  - Admin status checking
  - JWT token validation
  - Protected endpoint access

### Quick Command Reference
```bash
task test              # Run all tests
task test:auth         # Auth tests only
task test:admin        # Admin tests only
task test:cov          # With coverage
task test:check        # Verify backend
task setup             # Setup environment
```

## Additional Resources

- [pytest documentation](https://docs.pytest.org/)
- [httpx documentation](https://www.python-httpx.org/)
- [uv documentation](https://github.com/astral-sh/uv)
