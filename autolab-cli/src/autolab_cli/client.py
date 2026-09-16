import click
import requests


class ApiError(click.ClickException):
    def __init__(self, method: str, path: str, status_code: int, detail):
        super().__init__(f"{method} {path} -> {status_code}: {detail}")
        self.status_code = status_code


class ApiClient:
    """Thin wrapper around the /api/v1 REST surface described in docs/api.md."""

    def __init__(self, base_url: str, token: str | None = None):
        self.root_base_url = base_url.rstrip("/")
        self.base_url = self.root_base_url + "/api/v1"
        self.token = token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(method, url, headers=self._headers(), timeout=30, **kwargs)
        except requests.exceptions.RequestException as e:
            raise click.ClickException(f"Request to {url} failed: {e}")
        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except ValueError:
                detail = resp.text
            raise ApiError(method, path, resp.status_code, detail)
        return resp

    def get(self, path: str, **kw) -> requests.Response:
        return self.request("GET", path, **kw)

    def post(self, path: str, **kw) -> requests.Response:
        return self.request("POST", path, **kw)

    def delete(self, path: str, **kw) -> requests.Response:
        return self.request("DELETE", path, **kw)
