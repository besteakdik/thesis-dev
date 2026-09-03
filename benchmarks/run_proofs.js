/**
 * benchmarks/run_proofs.js
 * ========================
 * 1000 sentetik kayıt üzerinde off-chain ölçüm:
 *   - witness + proof üretim süresi (ms)
 *   - off-chain doğrulama süresi (ms)
 *   - proof boyutu (byte)
 *
 * kullanım:
 *   node benchmarks/run_proofs.js
 */

const fs      = require("fs");
const path    = require("path");
const snarkjs = require(path.join(__dirname, "../zkp-circuits/node_modules/snarkjs"));

const WASM_PATH = path.join(__dirname, "../zkp-circuits/output/disaster_verify_js/disaster_verify.wasm");
const ZKEY_PATH = path.join(__dirname, "../zkp-circuits/output/disaster_verify.zkey");
const VKEY_PATH = path.join(__dirname, "../zkp-circuits/output/verification_key.json");
const CSV_PATH  = path.join(__dirname, "../data/synthetic/disaster_victims.csv");
const OUT_PATH  = path.join(__dirname, "proof_results.json");

const MIN_AGE = 18;

function needsThreshold(injuryLevel) {
    const t = { 0: 50, 1: 40, 2: 25, 3: 10 };
    return t[injuryLevel] ?? 30;
}

function loadCSV() {
    const raw    = fs.readFileSync(CSV_PATH, "utf8").trim().split("\n");
    const header = raw[0].split(",").map(h => h.trim());
    return raw.slice(1).map(line => {
        const cols   = line.split(",");
        const record = {};
        header.forEach((h, i) => record[h] = cols[i]?.trim());
        return record;
    });
}

function proofSizeBytes(proof) {
    return Buffer.byteLength(JSON.stringify(proof), "utf8");
}

async function main() {
    const victims = loadCSV();
    const vkey    = JSON.parse(fs.readFileSync(VKEY_PATH));
    const results = [];

    console.log(`[*] ${victims.length} kayıt üzerinde ölçüm başlıyor...\n`);

    for (let i = 0; i < victims.length; i++) {
        const v             = victims[i];
        const age           = parseInt(v.age);
        const needs_score   = parseInt(v.needs_score);
        const injury_level  = parseInt(v.injury_level);
        const threshold     = needsThreshold(injury_level);
        const salt          = Math.floor(Math.random() * 1e9);
        const commitment    = age + needs_score + salt;

        const inputs = {
            age:             String(age),
            needs_score:     String(needs_score),
            salt:            String(salt),
            min_age:         String(MIN_AGE),
            needs_threshold: String(threshold),
            commitment:      String(commitment),
        };

        // proof üretim süresi
        const t0 = performance.now();
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);
        const proof_ms = performance.now() - t0;

        // doğrulama süresi
        const t1 = performance.now();
        const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        const verify_ms = performance.now() - t1;

        results.push({
            victim_id:   v.victim_id,
            proof_ms:    parseFloat(proof_ms.toFixed(2)),
            verify_ms:   parseFloat(verify_ms.toFixed(2)),
            proof_bytes: proofSizeBytes(proof),
            is_eligible: publicSignals[0] === "1",
            valid,
        });

        if ((i + 1) % 100 === 0) {
            const avg = results.slice(-100).reduce((s, r) => s + r.proof_ms, 0) / 100;
            process.stdout.write(`  [${i + 1}/1000] son 100 kayıt ort. proof süresi: ${avg.toFixed(1)} ms\n`);
        }
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));

    // özet
    const proof_times  = results.map(r => r.proof_ms);
    const verify_times = results.map(r => r.verify_ms);
    const sizes        = results.map(r => r.proof_bytes);
    const mean  = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std   = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length); };

    console.log("\n── Özet ──────────────────────────────────────────");
    console.log(`  Proof üretim süresi : ${mean(proof_times).toFixed(1)} ± ${std(proof_times).toFixed(1)} ms`);
    console.log(`  Off-chain doğrulama : ${mean(verify_times).toFixed(1)} ± ${std(verify_times).toFixed(1)} ms`);
    console.log(`  Proof boyutu        : ${mean(sizes).toFixed(0)} ± ${std(sizes).toFixed(0)} byte`);
    console.log(`\n[+] sonuçlar kaydedildi: ${OUT_PATH}`);

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
