// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Verifier.sol";

/**
 * afet kaydı kontratı
 * ====================
 * zkp kanıtı doğrulanmış afetzede kayıtlarını blockchain'e yazar.
 * kişisel veri (yaş, ihtiyaç skoru) hiçbir zaman zincire gitmez —
 * yalnızca commitment değeri ve doğrulama sonucu saklanır.
 */
contract DisasterRegistry {

    Groth16Verifier public verifier;

    struct VictimRecord {
        uint256 commitment;   // hash(age, needs_score, salt)
        uint256 timestamp;
        bool    isVerified;
    }

    // commitment → kayıt
    mapping(uint256 => VictimRecord) public records;

    // doğrulama olayı — blockchain loguna yazılır
    event VictimVerified(
        uint256 indexed commitment,
        uint256 timestamp
    );

    constructor(address verifierAddress) {
        verifier = Groth16Verifier(verifierAddress);
    }

    /**
     * kanıtı doğrula ve kaydı blockchain'e yaz
     *
     * @param proof_a   zkp kanıtı parçası a
     * @param proof_b   zkp kanıtı parçası b
     * @param proof_c   zkp kanıtı parçası c
     * @param pubSignals açık sinyaller: [is_eligible, min_age, needs_threshold, commitment]
     */
    function verifyAndRegister(
        uint[2]    calldata proof_a,
        uint[2][2] calldata proof_b,
        uint[2]    calldata proof_c,
        uint[4]    calldata pubSignals
    ) external {
        // zkp kanıtını doğrula
        bool valid = verifier.verifyProof(proof_a, proof_b, proof_c, pubSignals);
        require(valid, "gecersiz zkp kaniti");

        // is_eligible = 1 olmali (pubSignals[0])
        require(pubSignals[0] == 1, "kriterler karsilanmiyor");

        uint256 commitment = pubSignals[3];

        // aynı commitment iki kez kaydedilemez
        require(!records[commitment].isVerified, "bu kayit zaten mevcut");

        records[commitment] = VictimRecord({
            commitment:  commitment,
            timestamp:   block.timestamp,
            isVerified:  true
        });

        emit VictimVerified(commitment, block.timestamp);
    }

    /**
     * commitment ile kayıt sorgusu
     */
    function getRecord(uint256 commitment) external view returns (VictimRecord memory) {
        return records[commitment];
    }
}
