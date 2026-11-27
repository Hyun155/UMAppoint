def test_chatbot_returns_authenticated_help(client, auth_headers_student):
    res = client.post(
        "/api/chat/message",
        headers=auth_headers_student,
        json={"message": "How do I book an appointment?"},
    )
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload.get("answer"), str)
    assert payload["answer"]
    assert isinstance(payload.get("suggestions"), list)


def test_chatbot_rejects_unauthenticated_requests(client):
    res = client.post("/api/chat/message", json={"message": "How do I book?"})
    assert res.status_code == 401


def test_chatbot_validates_empty_messages(client, auth_headers_student):
    res = client.post(
        "/api/chat/message",
        headers=auth_headers_student,
        json={"message": ""},
    )
    assert res.status_code == 422
