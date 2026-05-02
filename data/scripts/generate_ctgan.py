"""
sentetik afetzede verisi üretimi
=================================
ctgan (conditional tabular gan) ile gerçekçi ama tamamen yapay
afetzede kayıtları üretir. gerçek kişi verisi içermez.

kullanım:
    cd data && source .venv/bin/activate
    python scripts/generate_ctgan.py

çıktı:
    data/synthetic/seed_data.csv          — ctgan'ın eğitildiği tohum veri (200 kayıt)
    data/synthetic/disaster_victims.csv   — üretilen sentetik veri (1000 kayıt)
"""

import os
import pandas as pd
import numpy as np
from faker import Faker
from ctgan import CTGAN

fake = Faker("tr_TR")
np.random.seed(42)

# ── tohum veri ─────────────────────────────────────────────────────────────
# ctgan'ın öğreneceği küçük, elle tasarlanmış örnek set.
# koordinat merkezi: kahramanmaraş (37.57°n, 36.93°e) ± 0.5° (~50km etki alanı)

def build_seed_data(n: int = 200) -> pd.DataFrame:
    aid_types   = ["medical", "food", "shelter", "rescue"]
    aid_weights = [0.35, 0.30, 0.25, 0.10]

    records = []
    for i in range(n):
        # yaralanma seviyesi: 0=sağlam, 1=hafif, 2=ağır, 3=kritik
        injury = int(np.random.choice([0, 1, 2, 3], p=[0.20, 0.40, 0.25, 0.15]))

        # injury arttıkça needs_score da artar — ctgan bu korelasyonu öğrenecek
        needs_score = int(min(injury * 22 + np.random.randint(0, 20), 100))

        # yaş dağılımı: çocuk/yetişkin/yaşlı ağırlıkları
        age_vals    = list(range(1, 90))
        age_weights = [0.005]*17 + [0.012]*43 + [0.020]*29
        age_weights = [w / sum(age_weights) for w in age_weights]

        records.append({
            "age":          int(np.random.choice(age_vals, p=age_weights)),
            "location_lat": round(37.57 + np.random.uniform(-0.5, 0.5), 5),
            "location_lon": round(36.93 + np.random.uniform(-0.5, 0.5), 5),
            "injury_level": injury,
            "needs_score":  needs_score,
            "aid_type":     str(np.random.choice(aid_types, p=aid_weights)),
            "verified":     int(np.random.choice([1, 0], p=[0.85, 0.15])),
        })

    return pd.DataFrame(records)


# ── ctgan eğitimi ve sentetik veri üretimi ────────────────────────────────

def generate_synthetic(seed_df: pd.DataFrame, n_samples: int = 1000) -> pd.DataFrame:
    discrete_columns = ["injury_level", "aid_type", "verified"]

    print(f"[*] ctgan eğitiliyor ({len(seed_df)} tohum kayıt, 300 epoch)...")
    model = CTGAN(epochs=300, verbose=False)
    model.fit(seed_df, discrete_columns)

    print(f"[*] {n_samples} sentetik kayıt üretiliyor...")
    synthetic = model.sample(n_samples)

    # gan bazen sınır dışı değer üretir — kırp ve düzelt
    synthetic["age"]          = synthetic["age"].clip(1, 99).astype(int)
    synthetic["needs_score"]  = synthetic["needs_score"].clip(0, 100).astype(int)
    synthetic["injury_level"] = synthetic["injury_level"].clip(0, 3).astype(int)
    synthetic["location_lat"] = synthetic["location_lat"].clip(37.0, 38.1).round(5)
    synthetic["location_lon"] = synthetic["location_lon"].clip(36.4, 37.5).round(5)
    synthetic["verified"]     = synthetic["verified"].clip(0, 1).astype(int)

    # id ve zaman damgası ekle (bunları ctgan'a öğretmiyoruz, sonradan ekliyoruz)
    synthetic.insert(0, "victim_id", [f"SYN-{i+1:05d}" for i in range(n_samples)])
    synthetic["request_time"] = [
        fake.date_time_between(start_date="-30d", end_date="now")
               .strftime("%Y-%m-%d %H:%M:%S")
        for _ in range(n_samples)
    ]

    return synthetic


# ── ana akış ───────────────────────────────────────────────────────────────

def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "synthetic")
    os.makedirs(out_dir, exist_ok=True)

    seed_df = build_seed_data(n=200)
    seed_path = os.path.join(out_dir, "seed_data.csv")
    seed_df.to_csv(seed_path, index=False)
    print(f"[+] tohum veri kaydedildi: {seed_path}")

    synthetic_df = generate_synthetic(seed_df, n_samples=1000)
    synth_path = os.path.join(out_dir, "disaster_victims.csv")
    synthetic_df.to_csv(synth_path, index=False)
    print(f"[+] sentetik veri kaydedildi: {synth_path}")

    print("\n── özet istatistik ──────────────────────────────")
    print(synthetic_df[["age", "injury_level", "needs_score"]].describe().round(2))
    print("\nyardım türü dağılımı:")
    print(synthetic_df["aid_type"].value_counts())
    print("\ndoğrulanma oranı (1=true):")
    print(synthetic_df["verified"].value_counts(normalize=True).round(3))


if __name__ == "__main__":
    main()
