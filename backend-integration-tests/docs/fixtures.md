# Test Fixtures

Reusable pytest fixtures defined in `tests/conftest.py`.

## Available Fixtures

### License Management

#### `generate_license`
**Type:** Async function fixture
**Dependencies:** `admin_authenticated_client`
**Scope:** Function

Provides a helper function to generate licenses for users. Automatically uses admin authentication.

**Signature:**
```python
async def generate_license(
    email: str,
    days: int = 365,
    level: Optional[str] = None
) -> Optional[str]
```

**Parameters:**
- `email` - Email of the user to generate license for
- `days` - Number of days until license expiry (default: 365)
- `level` - License level/tier, e.g., "premium", "standard", "enterprise" (optional)

**Returns:** Confirmation message string if successful, None otherwise

**Example:**
```python
async def test_with_licensed_user(generate_license, test_user_credentials):
    user_email = test_user_credentials["email"]

    # Generate a 90-day premium license
    result = await generate_license(user_email, days=90, level="premium")
    assert result is not None
    assert "generated" in result.lower()
```

**Direct API Call Example:**
```python
async def test_license_generation(admin_authenticated_client):
    response = await admin_authenticated_client.post(
        "/admin/license/generate",
        json={
            "email": "user@example.com",
            "days": 365,
            "level": "premium"  # optional
        }
    )
    assert response.status_code == 200
```

**Note:** The backend uses an untagged enum for license requests, so the JSON is sent directly without variant wrapping.

### HTTP Clients

#### `http_client`
Unauthenticated async HTTP client.

**Use when:** Testing public endpoints (register, login)

```python
async def test_public_endpoint(http_client):
    response = await http_client.get("/public/status")
    assert response.status_code == 200
```

#### `authenticated_client`
HTTP client with test user token pre-configured.

**Use when:** Testing user endpoints that require authentication

```python
async def test_user_endpoint(authenticated_client):
    response = await authenticated_client.get("/user/profile")
    assert response.status_code == 200
```

#### `admin_authenticated_client`
HTTP client with admin user token pre-configured.

**Use when:** Testing admin-only endpoints

```python
async def test_admin_endpoint(admin_authenticated_client):
    response = await admin_authenticated_client.get("/admin/listusers")
    assert response.status_code == 200
```

### Authentication Tokens

#### `test_user_token`
JWT token string for the test user.

**Use when:** You need the raw token (e.g., testing token validation)

```python
async def test_token_format(test_user_token):
    assert test_user_token.startswith("eyJ")  # JWT format
    assert len(test_user_token) > 100
```

#### `test_admin_token`
JWT token string for the admin user.

```python
async def test_admin_token(test_admin_token, http_client):
    response = await http_client.get(
        "/admin/check_admin_status",
        headers={"Authorization": f"Bearer {test_admin_token}"}
    )
    assert response.status_code == 200
```

### Credentials

#### `test_user_credentials`
Dictionary with test user email and password.

```python
def test_credentials_format(test_user_credentials):
    assert "email" in test_user_credentials
    assert "password" in test_user_credentials
    assert "@example.com" in test_user_credentials["email"]
```

#### `test_admin_credentials`
Dictionary with test admin email and password.

### Configuration

#### `base_url`
API base URL string (e.g., `http://localhost:8080/api/v1`).

```python
def test_base_url(base_url):
    assert base_url.endswith("/api/v1")
```

#### `request_timeout`
Request timeout in seconds (default: 30).

#### `backend_health_check`
Ensures backend is running before tests start.

**Use when:** Your test requires the backend to be responsive

```python
async def test_requires_backend(http_client, backend_health_check):
    # Test will fail fast if backend is down
    response = await http_client.get("/health")
    assert response.status_code == 200
```

## Fixture Behaviors

### Auto-Registration
`test_user_token` and `test_admin_token` fixtures automatically:
1. Register the user (if not already registered)
2. Login to get a fresh token
3. Return the token

This means you don't need to manually set up users!

### Token Caching
Tokens are session-scoped where possible to improve test performance.

### Error Handling
If a fixture fails to obtain credentials, the test will fail with a clear error message.

## Helper Functions

These are defined in `conftest.py` but not directly usable as fixtures:

### `register_user(client, email, password, company_name)`
Registers a new user account.

### `login_user(client, email, password)`
Logs in and returns the JWT token.

### `ensure_user_registered(client, email, password, company_name)`
Registers user if not already registered (idempotent).

## Combining Fixtures

You can use multiple fixtures in a single test:

```python
async def test_with_multiple_fixtures(
    authenticated_client,
    admin_authenticated_client,
    test_user_token,
    backend_health_check
):
    # Regular user request
    user_response = await authenticated_client.get("/user/profile")
    assert user_response.status_code == 200

    # Admin request
    admin_response = await admin_authenticated_client.get("/admin/users")
    assert admin_response.status_code == 200

    # Verify token format
    assert test_user_token.count(".") == 2  # JWT has 3 parts
```

## Creating Custom Fixtures

Add new fixtures to `tests/conftest.py`:

```python
@pytest.fixture
async def my_custom_data(authenticated_client):
    """Create test data for tests."""
    response = await authenticated_client.post(
        "/user/data",
        json={"name": "test"}
    )
    return response.json()
```

Usage:
```python
async def test_using_custom_fixture(my_custom_data):
    assert my_custom_data["name"] == "test"
```

## Best Practices

1. **Use the highest-level fixture** that meets your needs:
   - Need auth? Use `authenticated_client` (not `test_user_token` + manual headers)
   - Testing public endpoint? Use `http_client`

2. **Don't create unnecessary users:**
   - Use the provided `test_user` and `test_admin` fixtures
   - Only create new users when testing registration itself

3. **Keep fixtures focused:**
   - Each fixture should do one thing well
   - Compose fixtures for complex scenarios

4. **Document your custom fixtures:**
   - Add docstrings explaining what they provide
   - Include usage examples
