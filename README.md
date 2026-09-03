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
```

## Quick Start

**1. Generate synthetic victim data**
```bash
cd data
source .venv/bin/activate
python scripts/generate_ctgan.py
```

**2. Generate a ZKP proof**
```bash
cd zkp-circuits
node generate_proof.js
```

**3. Deploy contracts and submit proof to blockchain**
```bash
cd contracts
npx hardhat node --port 8545   # run in a separate terminal
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/submit_proof.js --network localhost
```

**4. DID / Verifiable Credential demo**
```bash
cd identity
.venv/bin/python3.11 demo.py
```

Each step outputs only the commitment value — personal data (age, needs score) is never printed.

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
