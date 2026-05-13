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

// dosya yolları
const WASM_PATH = "output/disaster_verify_js/disaster_verify.wasm";
const ZKEY_PATH = "output/disaster_verify.zkey";
const VKEY_PATH = "output/verification_key.json";
const LOG_PATH  = "proof_log.json";

// public sinyal isimleri — snarkjs sıralı dizi üretiyor, biz isimlendiriyoruz
const PUBLIC_SIGNAL_NAMES = ["is_eligible", "min_age", "needs_threshold", "commitment"];

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

// örnek: SYN-00001
generateAndVerify("SYN-00001", {
    age:             "45",
    needs_score:     "75",
    salt:            "12345",
    min_age:         "18",
    needs_threshold: "30",
    commitment:      "12465",  // 45 + 75 + 12345
}).catch(console.error);
