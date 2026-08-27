"""
vc_issuer.py
============
W3C Verifiable Credential (VC) verme modülü.

Otorite (authority) bir afetzede için VC imzalar.
VC içeriği:
  - kimin için verildiği (victim DID)
  - commitment değeri (ZKP'deki commitment ile aynı)
  - uygunluk sonucu (is_eligible)
  - eşik değerleri (min_age, needs_threshold)

Kişisel veri (yaş, ihtiyaç skoru) VC'ye YAZILMAZ.
"""

import json
import os
import hashlib
import secrets
from datetime import datetime, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption

CREDENTIALS_DIR = os.path.join(os.path.dirname(__file__), "..", "credentials")
os.makedirs(CREDENTIALS_DIR, exist_ok=True)


def _sign(private_key_hex: str, message: str) -> str:
    """Ed25519 ile mesajı imzala, hex döndür."""
    priv_bytes  = bytes.fromhex(private_key_hex)
    private_key = Ed25519PrivateKey.from_private_bytes(priv_bytes)
    signature   = private_key.sign(message.encode())
    return signature.hex()


def issue_vc(
    authority_did: str,
    authority_private_key_hex: str,
    victim_did: str,
    commitment: int,
    is_eligible: bool,
    min_age: int,
    needs_threshold: int
) -> dict:
    """
    Afetzede için Verifiable Credential oluşturur ve imzalar.

    Parametreler
    ------------
    authority_did            : VC'yi veren otoritenin DID'i
    authority_private_key_hex: otoritenin gizli anahtarı
    victim_did               : VC'nin verildiği afetzede DID'i
    commitment               : ZKP commitment değeri (age + needs_score + salt)
    is_eligible              : doğrulama sonucu
    min_age                  : uygulanan yaş eşiği
    needs_threshold          : uygulanan ihtiyaç eşiği

    Döndürür
    --------
    dict : W3C VC formatında imzalı credential
    """
    vc_id      = f"vc:disaster:{secrets.token_hex(6)}"
    issued_at  = datetime.now(timezone.utc).isoformat()
    key_id     = f"{authority_did}#key-1"

    # VC gövdesi — kişisel veri yok
    vc = {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://w3id.org/disaster-relief/v1"
        ],
        "id":           vc_id,
        "type":         ["VerifiableCredential", "DisasterReliefCredential"],
        "issuer":       authority_did,
        "issuanceDate": issued_at,
        "credentialSubject": {
            "id":             victim_did,
            "commitment":     str(commitment),
            "isEligible":     is_eligible,
            "minAge":         min_age,
            "needsThreshold": needs_threshold
        }
    }

    # imzalanacak mesaj: VC gövdesinin hash'i
    vc_canonical = json.dumps(vc, sort_keys=True)
    signature    = _sign(authority_private_key_hex, vc_canonical)

    # W3C proof bloğu
    vc["proof"] = {
        "type":               "Ed25519Signature2020",
        "created":            issued_at,
        "verificationMethod": key_id,
        "proofPurpose":       "assertionMethod",
        "signature":          signature
    }

    # diske kaydet
    safe_id   = vc_id.replace(":", "_")
    vc_path   = os.path.join(CREDENTIALS_DIR, f"{safe_id}.json")
    with open(vc_path, "w") as f:
        json.dump(vc, f, indent=2)

    print(f"[+] VC verildi: {vc_id}")
    print(f"    konu      : {victim_did}")
    print(f"    commitment: {commitment}")
    print(f"    uygun     : {is_eligible}")

    return vc
