"""
test_backend.py - Unit test untuk SOAPI FastAPI Backend
Menguji endpoint /health, /generate-soap, dan /recommend-icd dengan mock LLM & verifikasi Pydantic
"""

import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app, retrieve_icd_candidates, SOAPModel

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["csv_loaded"] is True


def test_icd_retrieval_candidates():
    # Test pencarian hipertensi
    candidates = retrieve_icd_candidates("Hipertensi Esensial Primer", top_k=5)
    assert len(candidates) >= 5
    codes = [c["kode"] for c in candidates]
    assert "I10" in codes

    # Test pencarian batuk / ISPA
    candidates_ispa = retrieve_icd_candidates("ISPA batuk dan pilek", top_k=5)
    codes_ispa = [c["kode"] for c in candidates_ispa]
    assert "J06.9" in codes_ispa or "J00" in codes_ispa


def test_generate_soap_validation_error():
    # Transcript terlalu pendek atau kosong
    response = client.post("/generate-soap", json={"transcript": "abc"})
    assert response.status_code == 422  # Pydantic min_length validation error


def test_generate_soap_with_mock_llm():
    mock_openai_response = MagicMock()
    mock_message = MagicMock()
    mock_message.content = json.dumps({
        "subjective": "Pasien mengeluh pusing dan tengkuk kaku.",
        "objective": "TD 150/95 mmHg, nadi 84x/menit.",
        "assessment": "Hipertensi Primer Stage 2.",
        "plan": "Amlodipine 10mg 1x1 tab pagi, kontrol 2 minggu.",
        "intervention": "Edukasi diet rendah natrium dan kepatuhan obat."
    })
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_openai_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_openai_response

    with patch("backend.main.get_ai_client_and_model", return_value=(mock_client, "gemini-2.5-flash", "Google Gemini")):
        response = client.post(
            "/generate-soap",
            json={
                "transcript": "Dokter: Tensinya 150/95 ya pak. Pasien: Kepala saya pusing dan leher kaku dok. Dokter: Kita beri Amlodipine 10mg ya."
            },
        )
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        assert res_data["soap"]["subjective"] == "Pasien mengeluh pusing dan tengkuk kaku."
        assert res_data["soap"]["assessment"] == "Hipertensi Primer Stage 2."
        assert "Amlodipine" in res_data["soap"]["plan"]

        # Pastikan temperature=0 dan json_object dipanggil
        mock_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0
        assert call_kwargs["response_format"] == {"type": "json_object"}


def test_recommend_icd_with_mock_llm():
    # 1. Mock Extraction LLM
    mock_extraction_resp = MagicMock()
    mock_extraction_resp.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "istilah_diagnosis_untuk_icd": "Hipertensi Primer",
                    "keywords": ["hipertensi", "hypertension"]
                })
            )
        )
    ]

    # 2. Mock Verification LLM
    mock_verification_resp = MagicMock()
    mock_verification_resp.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "selected_code": "I10",
                    "selected_description": "Essential (primary) hypertension",
                    "confidence": 0.98,
                    "evidence": "Tekanan darah pasien terukur 150/95 mmHg dan asesmen Hipertensi Primer.",
                    "reasoning": "Kode I10 mencakup hipertensi primer tanpa komplikasi jantung atau ginjal."
                })
            )
        )
    ]

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        mock_extraction_resp,
        mock_verification_resp,
    ]

    with patch("backend.main.get_ai_client_and_model", return_value=(mock_client, "gemini-2.5-flash", "Google Gemini")):
        payload = {
            "soap": {
                "subjective": "Pasien mengeluh leher tegang.",
                "objective": "TD 150/95 mmHg.",
                "assessment": "Hipertensi Primer Stage 2.",
                "plan": "Amlodipine 10mg 1x1 tab.",
                "intervention": "Konseling garam rendah."
            }
        }
        response = client.post("/recommend-icd", json=payload)
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        assert res_data["selected_code"] == "I10"
        assert res_data["confidence"] == 0.98
        assert "150/95 mmHg" in res_data["evidence"]
        assert len(res_data["candidates"]) >= 5
        codes = [c["kode"] for c in res_data["candidates"]]
        assert "I10" in codes
