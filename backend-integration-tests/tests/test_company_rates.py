"""Persistence and validation of additional company labor rates."""

from copy import deepcopy

import pytest


@pytest.mark.integration
async def test_company_labor_rates_round_trip(authenticated_client):
    client = authenticated_client
    response = await client.get("/getcompanyinfo")
    assert response.status_code == 200
    original = response.json()
    updated = deepcopy(original)
    updated["pricing_preferences"]["norm_rates"] = [
        {"id": "paint", "name": "Фарбування", "amount": 900.5},
        {"id": "arm", "name": "Арматурні роботи", "amount": 0},
    ]
    try:
        response = await client.post("/updatecompanyinfo", json=updated)
        assert response.status_code == 200, response.text
        stored = await client.get("/getcompanyinfo")
        assert stored.json()["pricing_preferences"]["norm_rates"] == updated["pricing_preferences"]["norm_rates"]
        assert stored.json()["pricing_preferences"]["norm_price"] == original["pricing_preferences"]["norm_price"]

        for invalid_rates in [
            [{"id": "base", "name": "Reserved", "amount": 10}],
            [{"id": "negative", "name": "Negative", "amount": -1}],
            [{"id": "empty", "name": " ", "amount": 10}],
            [{"id": "same", "name": "A", "amount": 10}, {"id": "same", "name": "B", "amount": 20}],
        ]:
            invalid = deepcopy(updated)
            invalid["pricing_preferences"]["norm_rates"] = invalid_rates
            response = await client.post("/updatecompanyinfo", json=invalid)
            assert response.status_code == 400, response.text
            stored = await client.get("/getcompanyinfo")
            assert stored.json()["pricing_preferences"]["norm_rates"] == updated["pricing_preferences"]["norm_rates"]
    finally:
        response = await client.post("/updatecompanyinfo", json=original)
        assert response.status_code == 200
