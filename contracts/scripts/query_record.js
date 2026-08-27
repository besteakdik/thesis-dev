/**
 * query_record.js
 * ===============
 * Blockchain'e yazılmış bir kaydı commitment değeriyle sorgular.
 * Yeni proof üretmez, transaction göndermez — sadece okur.
 *
 * kullanım:
 *   npx hardhat run scripts/query_record.js --network localhost
 */

const hre = require("hardhat");
const fs  = require("fs");

async function main() {
    const addresses = JSON.parse(fs.readFileSync("deployed_addresses.json"));
    const registry  = await hre.ethers.getContractAt("DisasterRegistry", addresses.registry);

    // proof_log.json'dan son commitment'ı al
    const logPath = "../zkp-circuits/proof_log.json";
    const log     = JSON.parse(fs.readFileSync(logPath));
    const last    = log[log.length - 1];
    const commitment = BigInt(last.public_signals.commitment);

    console.log(`\n[*] sorgulanıyor — commitment: ${commitment}`);
    console.log(`    kayıt sahibi: ${last.victim_id}  (kimlik gizli)`);

    const record = await registry.getRecord(commitment);

    if (!record.isVerified) {
        console.log("[!] bu commitment için kayıt bulunamadı.");
        console.log("    (submit_proof.js önce çalıştırılmalı)");
        return;
    }

    console.log(`\n[+] blockchain kaydı:`);
    console.log(`    commitment : ${record.commitment}`);
    console.log(`    timestamp  : ${new Date(Number(record.timestamp) * 1000).toISOString()}`);
    console.log(`    isVerified : ${record.isVerified}`);
    console.log(`\n    Kişisel veri (yaş, skor) zincirde yok.`);
    console.log(`    Kayıt değiştirilemez — blok zincirinde kalıcı.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
