/**
 * proof üretici ve doğrulayıcı
 * =============================
 * bir afetzede kaydı için zkp kanıtı üretir, doğrular ve loglar.
 * gizli değerler (age, needs_score) hiçbir çıktıya yazılmaz.
 *
 * kullanım:
 *   node generate_proof.js
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

// dosya yolları
const WASM_PATH = "output/disaster_verify_js/disaster_verify.wasm";
const ZKEY_PATH = "output/disaster_verify.zkey";
const VKEY_PATH = "output/verification_key.json";
const LOG_PATH  = "proof_log.json";
const CSV_PATH  = path.join(__dirname, "../data/synthetic/disaster_victims.csv");

// yaş eşiği
const MIN_AGE = 18;

// injury_level'a göre dinamik ihtiyaç eşiği
function needsThreshold(injuryLevel) {
    const thresholds = { 0: 50, 1: 40, 2: 25, 3: 10 };
    return thresholds[injuryLevel] ?? 30;
}

// public sinyal isimleri — snarkjs sıralı dizi üretiyor, biz isimlendiriyoruz
const PUBLIC_SIGNAL_NAMES = ["is_eligible", "min_age", "needs_threshold", "commitment"];

// CSV'den rastgele bir kayıt oku
function randomVictimFromCSV() {
    const raw   = fs.readFileSync(CSV_PATH, "utf8").trim().split("\n");
    const header = raw[0].split(",");
    const rows   = raw.slice(1);
    const row    = rows[Math.floor(Math.random() * rows.length)].split(",");
    const record = {};
    header.forEach((h, i) => record[h.trim()] = row[i]?.trim());
    return record;
}

async function generateAndVerify(victimId, inputs) {
    console.log(`\n[*] kanıt üretiliyor — ${victimId}`);

    // witness + proof tek adımda
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);

    // public sinyallere isim ekle
    const annotatedPublic = {};
    PUBLIC_SIGNAL_NAMES.forEach((name, i) => {
        annotatedPublic[name] = publicSignals[i];
    });

    console.log("[+] açık sinyaller:");
    console.table(annotatedPublic);

    // doğrula
    const vkey = JSON.parse(fs.readFileSync(VKEY_PATH));
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    console.log(`[+] doğrulama: ${isValid ? "GEÇERLİ ✓" : "GEÇERSİZ ✗"}`);

    // logla — gizli değerler (age, needs_score, salt) yazılmıyor
    const logEntry = {
        victim_id:      victimId,
        timestamp:      new Date().toISOString(),
        public_signals: annotatedPublic,
        is_valid:       isValid,
    };

    let log = [];
    if (fs.existsSync(LOG_PATH)) {
        log = JSON.parse(fs.readFileSync(LOG_PATH));
    }
    log.push(logEntry);
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    console.log(`[+] log kaydedildi: ${LOG_PATH}`);

    return { proof, annotatedPublic, isValid };
}

// CSV'den rastgele kayıt seç
const victim = randomVictimFromCSV();
const age          = parseInt(victim.age);
const needs_score  = parseInt(victim.needs_score);
const injury_level = parseInt(victim.injury_level);
const threshold    = needsThreshold(injury_level);
const salt         = Math.floor(Math.random() * 100000);
const commitment   = age + needs_score + salt;

console.log(`\n[*] seçilen kayıt: ${victim.victim_id}  (age ve score gizli kalacak)`);
console.log(`    injury_level: ${injury_level}  →  needs_threshold: ${threshold}`);

generateAndVerify(victim.victim_id, {
    age:             String(age),
    needs_score:     String(needs_score),
    salt:            String(salt),
    min_age:         String(MIN_AGE),
    needs_threshold: String(threshold),
    commitment:      String(commitment),
}).then(() => process.exit(0)).catch(console.error);
