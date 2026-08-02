import server


def test_health_and_readiness_fail_closed_without_verified_artifact():
    client = server.app.test_client()
    health = client.get("/health")
    readiness = client.get("/ready")

    assert health.status_code == 200
    assert health.get_json()["model_contract"] == "not-ready"
    assert health.get_json()["ready"] is False
    assert readiness.status_code == 503
