"""
benchmarks/analyze.py
=====================
proof_results.json ve onchain_results.json'dan istatistik tablosu
ve 2 grafik üretir:
  - Şekil 1: Proof üretim süresi dağılımı (histogram)
  - Şekil 2: On-chain gas maliyeti dağılımı (histogram)

Çıktılar: benchmarks/figures/ klasörüne kaydedilir.

kullanım:
  python3.11 benchmarks/analyze.py
"""

import json
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")  # ekran gerektirmez
import matplotlib.pyplot as plt

BASE   = os.path.dirname(__file__)
PROOF  = os.path.join(BASE, "proof_results.json")
ONCHAIN = os.path.join(BASE, "onchain_results.json")
FIGS   = os.path.join(BASE, "figures")
os.makedirs(FIGS, exist_ok=True)

# ── veri yükle ────────────────────────────────────────────
proof_data   = json.load(open(PROOF))
onchain_data = json.load(open(ONCHAIN))

proof_ms   = np.array([r["proof_ms"]   for r in proof_data])
verify_ms  = np.array([r["verify_ms"]  for r in proof_data])
proof_bytes = np.array([r["proof_bytes"] for r in proof_data])

eligible   = [r for r in onchain_data if r.get("eligible") and r.get("gas_used")]
gas_used   = np.array([r["gas_used"] for r in eligible])
tx_ms      = np.array([r["tx_ms"]    for r in eligible])

# ── istatistik tablosu ────────────────────────────────────
print("\n── Benchmark Sonuçları (n=1000) ─────────────────────────────────")
print(f"{'Metrik':<30} {'Ortalama':>12} {'Std':>10} {'Min':>10} {'Max':>10}")
print("-" * 74)
rows = [
    ("Proof üretim süresi (ms)",  proof_ms),
    ("Off-chain doğrulama (ms)",  verify_ms),
    ("Proof boyutu (byte)",        proof_bytes),
    ("On-chain gas",               gas_used),
    ("Tx onay süresi (ms)",        tx_ms),
]
for label, arr in rows:
    print(f"{label:<30} {arr.mean():>12.1f} {arr.std():>10.1f} {arr.min():>10.1f} {arr.max():>10.1f}")

print(f"\nUygun kayıt   : {len(eligible)} / {len(onchain_data)} (%{100*len(eligible)/len(onchain_data):.1f})")
print(f"Uygun değil   : {len(onchain_data)-len(eligible)} / {len(onchain_data)}")

# ── Şekil 1: Proof üretim süresi histogramı ───────────────
fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(proof_ms, bins=40, color="#2c7bb6", edgecolor="white", linewidth=0.5)
ax.axvline(proof_ms.mean(), color="#d7191c", linewidth=1.8,
           label=f"Mean: {proof_ms.mean():.1f} ms")
ax.axvline(proof_ms.mean() - proof_ms.std(), color="#d7191c",
           linewidth=1, linestyle="--", alpha=0.7)
ax.axvline(proof_ms.mean() + proof_ms.std(), color="#d7191c",
           linewidth=1, linestyle="--", alpha=0.7,
           label=f"± 1 std: {proof_ms.std():.1f} ms")
ax.set_xlabel("Proof generation time (ms)", fontsize=11)
ax.set_ylabel("Number of records", fontsize=11)
ax.set_title("ZKP Proof Generation Time Distribution (n=1000)", fontsize=12)
ax.legend(fontsize=10)
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
out1 = os.path.join(FIGS, "proof_time_distribution.pdf")
plt.savefig(out1, dpi=150)
plt.savefig(out1.replace(".pdf", ".png"), dpi=150)
plt.close()
print(f"\n[+] Şekil 1 kaydedildi: {out1}")

# ── Şekil 2: On-chain gas histogramı ──────────────────────
fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(gas_used, bins=30, color="#1a9641", edgecolor="white", linewidth=0.5)
ax.axvline(gas_used.mean(), color="#d7191c", linewidth=1.8,
           label=f"Mean: {gas_used.mean():.0f} gas")
ax.axvline(gas_used.mean() - gas_used.std(), color="#d7191c",
           linewidth=1, linestyle="--", alpha=0.7)
ax.axvline(gas_used.mean() + gas_used.std(), color="#d7191c",
           linewidth=1, linestyle="--", alpha=0.7,
           label=f"± 1 std: {gas_used.std():.0f} gas")
ax.set_xlabel("Gas cost (gasUsed)", fontsize=11)
ax.set_ylabel("Number of transactions", fontsize=11)
ax.set_title(f"On-Chain ZKP Verification Gas Cost Distribution (n={len(eligible)})", fontsize=12)
ax.legend(fontsize=10)
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
out2 = os.path.join(FIGS, "gas_distribution.pdf")
plt.savefig(out2, dpi=150)
plt.savefig(out2.replace(".pdf", ".png"), dpi=150)
plt.close()
print(f"[+] Şekil 2 kaydedildi: {out2}")
print("\nTamamlandı.")
