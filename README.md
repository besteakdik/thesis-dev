# Decentralized Disaster Data Verification — Thesis Prototype

MSc thesis prototype: privacy-preserving verification of disaster victim data using
Blockchain, Zero-Knowledge Proofs (zk-SNARK), and Decentralized Identity (DID).

**University:** Mugla Sitki Kocman University  
**Department:** Computer Engineering

---

## Problem

In disaster response, multiple teams (rescue, health, logistics) must share sensitive
data. Centralized systems are single points of failure and expose personal information.

## Approach

A decentralized verification system where:
- Victim eligibility is proven via zk-SNARK without exposing personal data
- Identity is managed through W3C DID/VC (no central authority)
- Verified records are anchored on a private Quorum blockchain

## Repository Structure

```
data/               — Synthetic data generation (CTGAN)
zkp-circuits/       — ZKP circuit definition (Circom/snarkjs)
contracts/          — Solidity smart contracts (Verifier + Registry)
identity/           — DID/VC simulation
blockchain/         — Quorum network setup
app-bridge/         — Integration layer
benchmarks/         — Performance evaluation
baseline-central/   — Centralized baseline for comparison
scenarios/          — End-to-end test scenarios
```

## Status

| Module | Status |
|--------|--------|
| data/ | Done — 1000 synthetic records via CTGAN |
| zkp-circuits/ | Done — circuit compiled, 18 constraints |
| contracts/ | In progress |
| identity/ | Planned |
| blockchain/ | Planned |
| app-bridge/ | Planned |

## Tech Stack

- Python 3.11, CTGAN, pandas
- Circom 2.0, snarkjs (Groth16)
- Solidity, Hardhat
- Quorum (private Ethereum)
- W3C DID / Verifiable Credentials

## Note

Synthetic data is used throughout. No real personal data is stored anywhere in this
repository. Seed parameters are calibrated to the February 2023 Kahramanmaraş earthquake
affected area for realistic disaster scenario modeling.
