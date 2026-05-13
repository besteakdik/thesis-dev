const hre = require("hardhat");

async function main() {
    // önce verifier kontratını deploy et
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`[+] verifier deploy edildi: ${verifierAddress}`);

    // sonra registry kontratını deploy et — verifier adresini parametre olarak alıyor
    const Registry = await hre.ethers.getContractFactory("DisasterRegistry");
    const registry = await Registry.deploy(verifierAddress);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`[+] registry deploy edildi: ${registryAddress}`);

    // adresleri kaydet — app-bridge bu adresleri kullanacak
    const fs = require("fs");
    const addresses = { verifier: verifierAddress, registry: registryAddress };
    fs.writeFileSync("deployed_addresses.json", JSON.stringify(addresses, null, 2));
    console.log("[+] adresler kaydedildi: deployed_addresses.json");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
