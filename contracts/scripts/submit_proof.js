const hre = require("hardhat");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function main() {
    // deploy edilmiş kontrat adresleri
    const addresses = JSON.parse(fs.readFileSync("deployed_addresses.json"));

    // zkp dosyaları
    const wasmPath = path.resolve("../zkp-circuits/output/disaster_verify_js/disaster_verify.wasm");
    const zkeyPath = path.resolve("../zkp-circuits/output/disaster_verify.zkey");
    const vkeyPath = path.resolve("../zkp-circuits/output/verification_key.json");

    // örnek afetzede girdisi
    const input = {
        age:             "45",
        needs_score:     "75",
        salt:            "12345",
        min_age:         "18",
        needs_threshold: "30",
        commitment:      "12465",
    };

    console.log("[*] zkp kanıtı üretiliyor...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    // önce js tarafında doğrula
    const vkey = JSON.parse(fs.readFileSync(vkeyPath));
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    console.log(`[+] js doğrulaması: ${isValid ? "GEÇERLİ ✓" : "GEÇERSİZ ✗"}`);

    // proof'u solidity formatına çevir
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const argv = JSON.parse("[" + calldata + "]");

    const proof_a = argv[0];
    const proof_b = argv[1];
    const proof_c = argv[2];
    const pubSignals = argv[3];

    console.log("[*] kontrata gönderiliyor...");
    console.log(`    commitment: ${pubSignals[3]}`);
    console.log(`    is_eligible: ${pubSignals[0]}`);

    // registry kontratına bağlan
    const registry = await hre.ethers.getContractAt("DisasterRegistry", addresses.registry);

    // blockchain'e gönder
    const tx = await registry.verifyAndRegister(proof_a, proof_b, proof_c, pubSignals);
    const receipt = await tx.wait();
    console.log(`[+] işlem onaylandı — blok: ${receipt.blockNumber}`);

    // kaydı sorgula
    const commitment = pubSignals[3];
    const record = await registry.getRecord(commitment);
    console.log(`[+] blockchain kaydı:`);
    console.log(`    commitment : ${record.commitment}`);
    console.log(`    timestamp  : ${new Date(Number(record.timestamp) * 1000).toISOString()}`);
    console.log(`    isVerified : ${record.isVerified}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
