"""
vc_verifier.py
==============
W3C Verifiable Credential doğrulama modülü.

Doğrulayan taraf (acil ekip, lojistik vb.) elindeki VC'nin:
  1. Güvenilir bir otorite tarafından imzalanıp imzalanmadığını
  2. Commitment değerinin ZKP kaydıyla eşleşip eşleşmediğini
kontrol eder.

Kişisel veri bu aşamada da görünmez.
"""

import json
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature


def _verify_signature(public_key_hex: str, message: str, signature_hex: str) -> bool:
    """Ed25519 imzasını doğrula."""
    try:
        pub_bytes  = bytes.fromhex(public_key_hex)
        public_key = Ed25519PublicKey.from_public_bytes(pub_bytes)
        public_key.verify(bytes.fromhex(signature_hex), message.encode())
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False


def verify_vc(vc: dict, authority_public_key_hex: str, expected_commitment: int = None) -> dict:
    """
    VC'yi doğrular.

    Parametreler
    ------------
    vc                      : doğrulanacak VC dict
    authority_public_key_hex: otoritenin açık anahtarı
    expected_commitment     : (opsiyonel) blockchain'deki commitment ile karşılaştır

    Döndürür
    --------
    dict : {
        signature_valid   : bool,
        commitment_match  : bool | None,
        is_eligible       : bool,
        subject_did       : str,
        issuer            : str,
        result            : "GEÇERLI" | "GEÇERSİZ"
    }
    """
    print("\n[*] VC doğrulanıyor...")

    # proof bloğunu ayır
    proof = vc.get("proof", {})
    signature_hex = proof.get("signature", "")

    # imzayı kontrol etmek için proof'suz VC gövdesi
    vc_without_proof = {k: v for k, v in vc.items() if k != "proof"}
    vc_canonical     = json.dumps(vc_without_proof, sort_keys=True)

    sig_valid = _verify_signature(authority_public_key_hex, vc_canonical, signature_hex)

    # commitment karşılaştırması (opsiyonel)
    commitment_match = None
    vc_commitment    = int(vc.get("credentialSubject", {}).get("commitment", -1))
    if expected_commitment is not None:
        commitment_match = (vc_commitment == expected_commitment)

    is_eligible = vc.get("credentialSubject", {}).get("isEligible", False)
    subject_did = vc.get("credentialSubject", {}).get("id", "?")
    issuer      = vc.get("issuer", "?")

    overall = sig_valid and (commitment_match if commitment_match is not None else True)

    result = {
        "signature_valid":  sig_valid,
        "commitment_match": commitment_match,
        "is_eligible":      is_eligible,
        "subject_did":      subject_did,
        "issuer":           issuer,
        "result":           "GEÇERLİ ✓" if overall else "GEÇERSİZ ✗"
    }

    print(f"    imza      : {'✓' if sig_valid else '✗'}")
    if commitment_match is not None:
        print(f"    commitment: {'✓ eşleşiyor' if commitment_match else '✗ eşleşmiyor'}")
    print(f"    uygun     : {is_eligible}")
    print(f"    konu      : {subject_did}")
    print(f"[+] sonuç     : {result['result']}")

    return result
