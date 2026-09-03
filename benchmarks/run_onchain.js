/**
 * benchmarks/run_onchain.js
 * =========================
 * proof_results.json'daki her kayıt için blockchain'e proof gönderir.
 * Her işlem için ölçer:
 *   - on-chain gas maliyeti (gasUsed)
 *   - tx onay süresi (ms)
 *
 * Çalıştırmadan önce:
 *   1. Hardhat node açık olmalı  (npx hardhat node --port 8545)
 *   2. Kontratlar deploy edilmiş olmalı (npx hardhat run scripts/deploy.js --network localhost)
 *   3. proof_results.json mevcut olmalı (node benchmarks/run_proofs.js)
 *
 * kullanım (contracts/ klasöründen):
 *   npx hardhat run ../benchmarks/run_onchain.js --network localhost
 */

const fs   = require("fs");
const path = require("path");
const hre  = require(path.join(__dirname, "../contracts/node_modules/hardhat"));

const snarkjs        = require(path.join(__dirname, "../zkp-circuits/node_modules/snarkjs"));
const WASM_PATH      = path.join(__dirname, "../zkp-circuits/output/disaster_verify_js/disaster_verify.wasm");
const ZKEY_PATH      = path.join(__dirname, "../zkp-circuits/output/disaster_verify.zkey");
const ADDRESSES_PATH = path.join(__dirname, "../contracts/deployed_addresses.json");
const CSV_PATH       = path.join(__dirname, "../data/synthetic/disaster_victims.csv");
const OUT_PATH       = path.join(__dirname, "onchain_results.json");

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

async function main() {
    const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH));
    const registry  = await hre.ethers.getContractAt("DisasterRegistry", addresses.registry);
    const victims   = loadCSV();
    const results   = [];

    console.log(`[*] ${victims.length} kayıt için on-chain ölçüm başlıyor...\n`);

    for (let i = 0; i < victims.length; i++) {
        const v            = victims[i];
        const age          = parseInt(v.age);
        const needs_score  = parseInt(v.needs_score);
        const injury_level = parseInt(v.injury_level);
        const threshold    = needsThreshold(injury_level);
        const salt         = Math.floor(Math.random() * 1e9);
        const commitment   = age + needs_score + salt;

        const inputs = {
            age:             String(age),
            needs_score:     String(needs_score),
            salt:            String(salt),
            min_age:         String(MIN_AGE),
            needs_threshold: String(threshold),
            commitment:      String(commitment),
        };

        // proof üret
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);

        // uygun değilse blockchain'e gönderme, sadece say
        if (publicSignals[0] !== "1") {
            results.push({ victim_id: v.victim_id, eligible: false });
            continue;
        }

        // calldata formatına çevir
        const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const argv     = JSON.parse("[" + calldata + "]");
        const [pA, pB, pC, pubSignals] = argv;

        // tx gönder ve ölç
        try {
            const t0 = performance.now();
            const tx = await registry.verifyAndRegister(pA, pB, pC, pubSignals);
            const receipt = await tx.wait();
            const tx_ms  = parseFloat((performance.now() - t0).toFixed(2));

            results.push({
                victim_id:  v.victim_id,
                eligible:   true,
                gas_used:   Number(receipt.gasUsed),
                tx_ms,
            });
        } catch (err) {
            process.stdout.write(`  [!] ${v.victim_id} tx hatası: ${err.message?.slice(0, 60)}\n`);
            results.push({ victim_id: v.victim_id, eligible: true, error: true });
        }

        if ((i + 1) % 100 === 0) {
            const slice   = results.slice(-100);
            const avg_gas = slice.reduce((s, r) => s + r.gas_used, 0) / 100;
            const avg_tx  = slice.reduce((s, r) => s + r.tx_ms,  0) / 100;
            process.stdout.write(`  [${i + 1}/1000]  gas: ${avg_gas.toFixed(0)}  tx: ${avg_tx.toFixed(1)} ms\n`);
        }
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));

    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std  = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length); };

    const eligible   = results.filter(r => r.eligible);
    const ineligible = results.filter(r => !r.eligible);
    const gases      = eligible.map(r => r.gas_used);
    const tx_mss     = eligible.map(r => r.tx_ms);

    console.log("\n── Özet ──────────────────────────────────────────");
    console.log(`  Toplam kayıt   : ${results.length}`);
    console.log(`  Uygun (chain)  : ${eligible.length}`);
    console.log(`  Uygun değil    : ${ineligible.length}`);
    console.log(`  On-chain gas   : ${mean(gases).toFixed(0)} ± ${std(gases).toFixed(0)} gas`);
    console.log(`  Tx onay süresi : ${mean(tx_mss).toFixed(1)} ± ${std(tx_mss).toFixed(1)} ms`);
    console.log(`\n[+] sonuçlar kaydedildi: ${OUT_PATH}`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
