"""
did_manager.py
==============
W3C DID (Decentralized Identifier) simülasyonu.
Her aktör (otorite, afetzede, doğrulayıcı) için DID ve DID Document üretir.
Gerçek sistemde blockchain'de çözümlenir; burada lokal JSON dosyalarıyla simüle edilir.

DID formatı: did:disaster:<tip>-<uuid_kısa>
Örnek:        did:disaster:victim-a3f9c2
"""

import json
import os
import secrets
from datetime import datetime, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)

KEYS_DIR = os.path.join(os.path.dirname(__file__), "..", "keys")
os.makedirs(KEYS_DIR, exist_ok=True)


def _short_id(prefix: str) -> str:
    """<prefix>-<6 hex> formatında kısa benzersiz ID üretir."""
    return f"{prefix}-{secrets.token_hex(3)}"


def create_did(role: str) -> dict:
    """
    Verilen rol için DID, anahtar çifti ve DID Document oluşturur.

    Parametreler
    ------------
    role : str
        Aktörün rolü — 'victim', 'authority', 'verifier'

    Döndürür
    --------
    dict
        {
          did           : DID string,
          did_document  : W3C DID Document,
          private_key_hex: gizli anahtar (hex),
          public_key_hex : açık anahtar (hex)
        }
    """
    # Ed25519 anahtar çifti
    private_key = Ed25519PrivateKey.generate()
    public_key  = private_key.public_key()

    pub_hex  = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
    priv_raw = private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    priv_hex = priv_raw.hex()

    did_id = f"did:disaster:{_short_id(role)}"
    key_id = f"{did_id}#key-1"

    did_document = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1"
        ],
        "id": did_id,
        "verificationMethod": [
            {
                "id":           key_id,
                "type":         "Ed25519VerificationKey2020",
                "controller":   did_id,
                "publicKeyHex": pub_hex
            }
        ],
        "authentication":  [key_id],
        "assertionMethod": [key_id],
        "created": datetime.now(timezone.utc).isoformat()
    }

    # anahtarları diske kaydet
    safe_name = did_id.replace(":", "_").replace("#", "_")
    key_path  = os.path.join(KEYS_DIR, f"{safe_name}.json")
    with open(key_path, "w") as f:
        json.dump({
            "did":             did_id,
            "role":            role,
            "private_key_hex": priv_hex,
            "public_key_hex":  pub_hex
        }, f, indent=2)

    print(f"[+] DID oluşturuldu ({role}): {did_id}")

    return {
        "did":             did_id,
        "did_document":    did_document,
        "private_key_hex": priv_hex,
        "public_key_hex":  pub_hex
    }


def load_did(did_id: str) -> dict:
    """Kaydedilmiş DID anahtarlarını yükler."""
    safe_name = did_id.replace(":", "_").replace("#", "_")
    key_path  = os.path.join(KEYS_DIR, f"{safe_name}.json")
    if not os.path.exists(key_path):
        raise FileNotFoundError(f"DID bulunamadı: {did_id}")
    with open(key_path) as f:
        return json.load(f)
