# Backend Authentication Flow

Understanding the backend authentication is crucial for writing tests.

## Two-Step Authentication Process

The backend uses a **register-then-login** flow, not register-and-auto-login.

### Step 1: Registration

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

**Important Notes:**
- ⚠️ Registration does **NOT** return a token
- ✅ The user account is created successfully
- 📝 You **must login separately** to get a token

### Step 2: Login

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

### Step 3: Using Protected Endpoints

Add the JWT token to the `Authorization` header:

```python
response = await client.get(
    "/api/v1/user/protected_endpoint",
    headers={"Authorization": f"Bearer {token}"}
)
```

## Admin Routes

Admin status is determined by the `backend-service-rust/admins.txt` file.

### Requirements for Admin Access
1. ✅ Valid JWT token (authenticated)
2. ✅ Email address listed in `admins.txt`

### Admin Route Patterns
- Admin routes: `/api/v1/admin/*`
- Examples:
  - `/api/v1/admin/listusers`
  - `/api/v1/admin/check_admin_status`
  - `/api/v1/admin/logs`

### Test Admin Configuration
The test admin email `test_admin@example.com` is pre-configured in `admins.txt`.

## Expected HTTP Status Codes

### Registration
- `200` / `201` - Success (empty body)
- `409` - User already exists
- `400` / `422` - Validation error

### Login
- `200` - Success (with token)
- `401` / `403` - Invalid credentials
- `404` - User not found

### Protected Endpoints
- `200` - Success
- `401` - No token or invalid token
- `403` - Valid token but insufficient permissions
- `404` - Endpoint not found or no access

### Admin Endpoints
- `200` - Success
- `401` - Not authenticated
- `403` - Authenticated but not admin
- `404` - Route not found or not accessible

## Code Examples

### Manual Registration and Login

```python
async def test_manual_auth(http_client):
    # Register
    reg_response = await http_client.post(
        "/register",
        json={
            "email": "newuser@example.com",
            "password": "secure123",
            "company_name": "Test Co"
        }
    )
    assert reg_response.status_code == 200
    # Note: No token in response!

    # Login to get token
    login_response = await http_client.post(
        "/login",
        json={
            "email": "newuser@example.com",
            "password": "secure123"
        }
    )
    assert login_response.status_code == 200
    token = login_response.json()["token"]

    # Use token for protected endpoint
    protected_response = await http_client.get(
        "/user/profile",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert protected_response.status_code == 200
```

### Using Test Fixtures (Recommended)

```python
async def test_with_fixture(authenticated_client):
    """Much simpler - fixture handles auth automatically!"""
    response = await authenticated_client.get("/user/profile")
    assert response.status_code == 200
```

See [fixtures.md](fixtures.md) for details on available authentication fixtures.
