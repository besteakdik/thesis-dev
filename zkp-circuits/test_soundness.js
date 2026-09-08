/**
 * zkp-circuits/test_soundness.js
 * ================================
 * M3 soundness attack testi:
 * BN254 alan elemanları (p-1 gibi) ile GreaterEqThan'ı atlatma girişimi.
 *
 * Beklenen davranış (Num2Bits EKLENMİŞ devreyle):
 *   - Olağan girdi  → proof üretilir, doğrulama geçer
 *   - age = p-1     → Num2Bits Assert Failed, proof üretilemez
 *   - score = p-1   → Num2Bits Assert Failed, proof üretilemez
 *
 * Çalıştırma:
 *   cd zkp-circuits
 *   node test_soundness.js
 */

"use strict";
const snarkjs          = require("./node_modules/snarkjs");
const { buildPoseidon} = require("./node_modules/circomlibjs");
const path             = require("path");

const WASM = path.resolve("./output/disaster_verify_js/disaster_verify.wasm");
const ZKEY = path.resolve("./output/disaster_verify.zkey");

const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

async function run() {
    const poseidon = await buildPoseidon();

    const cases = [
        { label: "Olağan (age=45, score=75)",      age: 45n,   score: 75n,  minAge: 18, threshold: 30 },
        { label: "Saldırı 1: age = p-1",           age: p-1n,  score: 5n,   minAge: 18, threshold: 30 },
        { label: "Saldırı 2: score = p-1",         age: 45n,   score: p-1n, minAge: 18, threshold: 30 },
        { label: "Saldırı 3: age=p-1, score=p-1",  age: p-1n,  score: p-1n, minAge: 18, threshold: 30 },
    ];

    console.log("\nM3 Soundness Attack Testi\n" + "=".repeat(40));

    for (const c of cases) {
        const salt       = BigInt(Math.floor(Math.random() * 1e15));
        const commitment = poseidon.F.toString(poseidon([c.age, c.score, salt]));

        const inputs = {
            age:             c.age.toString(),
            needs_score:     c.score.toString(),
            salt:            salt.toString(),
            min_age:         String(c.minAge),
            needs_threshold: String(c.threshold),
            commitment,
        };

        process.stdout.write(`\n[TEST] ${c.label}\n`);
        try {
            const { publicSignals } = await snarkjs.groth16.fullProve(inputs, WASM, ZKEY);
            console.log(`  Sonuç  : proof üretildi`);
            console.log(`  is_eligible = ${publicSignals[0]}`);
        } catch (err) {
            const short = (err.message || "").split("\n")[0].slice(0, 80);
            console.log(`  Sonuç  : HATA (beklenen) — ${short}`);
        }
    }
    console.log("\n" + "=".repeat(40));
}

run().catch(err => { console.error(err); process.exit(1); });