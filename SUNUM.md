# Tez Prototip — Ara Durum Sunumu

**Tez:** Exploring the Potential of Decentralized Methods for Trusted Data Sharing and Privacy-Preserving Data Verification in Multi-Party Scenarios  
**Öğrenci:** Beste Akdik — 234250003  
**Danışman:** Dr. Enis Karaarslan

---

## Genel Bakış

Tezin temel sorusu: afet gibi kriz senaryolarında farklı ekipler arasında kişisel veri açıklanmadan mahremiyeti koruyarak veri doğrulaması yapılabilir mi?

Prototip üç teknolojiyi birleştiriyor:

| Teknoloji | Rolü |
|-----------|------|
| CTGAN | Gerçekçi sentetik afetzede verisi üretimi |
| zk-SNARK (Circom + snarkjs) | Kişisel veri açıklamadan doğrulama kanıtı |
| Solidity (Hardhat) | Kanıtın blockchain'e kaydedilmesi |

Tezdeki work package sıralamasına göre ilerleniyor: WP1 (blockchain altyapısı) → WP2 (smart contracts) → WP3 (ZKP mekanizması). DID entegrasyonu (WP4) sırada bekliyor.

---

## Adım 1 — Sentetik Veri Üretimi

### Neden sentetik veri?
Gerçek afet mağduru verisi etik ve yasal kısıtlar nedeniyle kullanılamaz. CTGAN (Conditional Tabular GAN) ile istatistiksel olarak gerçekçi ama tamamen yapay kayıtlar üretildi. Bu, tez önerisinde de belirtilen yaklaşımla birebir örtüşüyor (Beaulieu-Jones et al., 2017).

### Üretilen veri seti

**Dosya:** `data/synthetic/disaster_victims.csv` — 1000 kayıt

| Alan | Açıklama |
|------|----------|
| victim_id | Anonim kayıt numarası |
| age | Yaş (1–99) |
| location_lat / lon | Kahramanmaraş bölgesi koordinatları |
| injury_level | 0=sağlam, 1=hafif, 2=ağır, 3=kritik |
| needs_score | İhtiyaç puanı (0–100) |
| aid_type | medical / food / shelter / rescue |
| verified | Doğrulanma durumu |
| request_time | Yardım talep zamanı |

**İstatistikler:**
- Kayıt sayısı: 1000
- Yaş ortalaması: 60.4 (min: 1, max: 99)
- needs_score ortalaması: 19.8
- Yardım türü: medical 334, food 305, shelter 226, rescue 135
- Injury level: 0→176, 1→386, 2→263, 3→175

**CSV'den örnek satırlar:**
```
victim_id,age,location_lat,location_lon,injury_level,needs_score,aid_type,verified,request_time
SYN-00001,92,37.95119,36.4,2,13,medical,1,2026-04-21 20:19:22
SYN-00002,89,37.24063,36.81964,2,9,food,1,2026-04-30 12:50:07
SYN-00003,7,37.73029,37.15407,1,26,shelter,1,2026-04-12 06:39:03
SYN-00004,53,37.31047,36.49769,2,57,rescue,0,2026-04-18 15:22:27
```

### Canlı gösterim

```bash
# veriyi üret (venv aktif olmalı)
cd data && source .venv/bin/activate
python scripts/generate_ctgan.py
```

**Beklenen çıktı:**
```
[*] CTGAN eğitiliyor (200 tohum kayıt, 300 epoch)...
[*] 1000 sentetik kayıt üretiliyor...
[+] tohum veri kaydedildi: data/synthetic/seed_data.csv
[+] sentetik veri kaydedildi: data/synthetic/disaster_victims.csv

── özet istatistik ──────────────────────────────
         age  injury_level  needs_score
count  1000.0       1000.0       1000.0
mean     60.4          1.4         19.8
...
```

---

## Adım 2 — ZKP Devresi (zk-SNARK)

### Ne yapıyor?
"Bu kişinin yaşı ve ihtiyaç skoru eşiği karşılıyor" iddiasını, yaş ve skoru kimseye açıklamadan kriptografik olarak ispatlıyor. tezimizdeki WP3 — Privacy Protection adımı.

### Temel kavramlar

**Gizli girdiler (private):** age, needs_score, salt → sadece kanıtlayıcı bilir, hiçbir zaman paylaşılmaz

**Açık girdiler (public):** min_age, needs_threshold, commitment → herkes görebilir

**commitment = age + needs_score + salt**  
Blockchain'e yalnızca bu tek sayı yazılır. Verinin değiştirilmediğini garanti eder, içeriği açıklamaz. Kriptografide "mühürlü zarf" olarak adlandırılır.

### Canlı gösterim

```bash
# devreyi derle
cd zkp-circuits
circom circuits/disaster_verify.circom --r1cs --wasm --sym -o output/ -l node_modules
```

**Beklenen çıktı:**
```
template instances: 1
non-linear constraints: 18
linear constraints: 0
public inputs: 3
private inputs: 3
public outputs: 1
wires: 31
labels: 36
Written successfully: output/disaster_verify.r1cs
Written successfully: output/disaster_verify.wasm
```

```bash
# trusted setup (kriptografik parametreler)
node node_modules/.bin/snarkjs powersoftau new bn128 12 output/pot12_0000.ptau
node node_modules/.bin/snarkjs powersoftau contribute output/pot12_0000.ptau output/pot12_0001.ptau -e="entropy"
node node_modules/.bin/snarkjs powersoftau prepare phase2 output/pot12_0001.ptau output/pot12_final.ptau
node node_modules/.bin/snarkjs groth16 setup output/disaster_verify.r1cs output/pot12_final.ptau output/disaster_verify.zkey
node node_modules/.bin/snarkjs zkey export verificationkey output/disaster_verify.zkey output/verification_key.json
```

```bash
# gerçek bir afetzede için kanıt üret ve doğrula
node generate_proof.js
```

**Beklenen çıktı:**
```
[*] kanıt üretiliyor — SYN-00001
[+] açık sinyaller:
┌─────────────────┬─────────┐
│ (index)         │ Values  │
├─────────────────┼─────────┤
│ is_eligible     │ '1'     │
│ min_age         │ '18'    │
│ needs_threshold │ '30'    │
│ commitment      │ '12465' │
└─────────────────┴─────────┘
[+] doğrulama: GEÇERLİ ✓
[+] log kaydedildi: proof_log.json
```

age=45 ve needs_score=75 değerleri hiçbir çıktıda görünmedi. Doğrulayan taraf yalnızca "bu kişi kriterleri karşılıyor" bilgisini aldı.

---

## Adım 3 — Akıllı Kontratlar (Solidity + Hardhat)

### Ne yapıyor?
Üretilen kanıt blockchain'e gönderiliyor. İki kontrat:

**Verifier.sol** — snarkjs tarafından otomatik üretildi. Blockchain üzerinde matematiksel ZKP doğrulaması yapıyor.

**DisasterRegistry.sol** — asıl kontrat. Verifier'ı çağırıyor; kanıt geçerliyse commitment değerini ve doğrulama zamanını zincire yazıyor. Kişisel veri zincire gitmiyor.

**Tam akış:**
```
generate_proof.js → proof.json + public.json
        ↓
DisasterRegistry.verifyAndRegister()
        ↓
Verifier.sol → matematiksel doğrulama
        ↓
Geçerliyse → commitment + timestamp blockchain'e yazılır
        ↓
VictimVerified eventi yayınlanır
```

### Canlı gösterim

```bash
# hardhat lokal ağını başlat (ayrı terminalde)
cd contracts
npx hardhat node --port 8545
```

```bash
# kontratları deploy et
npx hardhat run scripts/deploy.js --network localhost
```

**Beklenen çıktı:**
```
[+] verifier deploy edildi: 0x5FbDB2315678afecb367f032d93F642f64180aa3
[+] registry deploy edildi: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
[+] adresler kaydedildi: deployed_addresses.json
```

```bash
# zkp kanıtını blockchain'e gönder
npx hardhat run scripts/submit_proof.js --network localhost
```

**Beklenen çıktı:**
```
[*] zkp kanıtı üretiliyor...
[+] js doğrulaması: GEÇERLİ ✓
[*] kontrata gönderiliyor...
    commitment: 0x000...30b1
    is_eligible: 0x000...0001
[+] işlem onaylandı — blok: 1
[+] blockchain kaydı:
    commitment : 12465
    timestamp  : 2026-05-13T19:09:25.000Z
    isVerified : true
```

age=45 ve needs_score=75 blockchain'de hiçbir yerde görünmüyor. Zincirde yalnızca commitment ve doğrulama zamanı var.

---

## Tez Hipotezleri

| Hipotez | Prototip Durumu |
|---------|----------------|
| H1: Merkezi olmayan doğrulama daha güvenilir ve privacy-korumalı olabilir | Solidity kontratı merkezi otorite olmadan doğrulama yapıyor ✓ |
| H2: Blockchain + ZKP + DID entegrasyonu gizliliği koruyarak doğrulama yapabilir | ZKP + Blockchain entegrasyonu çalışıyor ✓ — DID sırada |

---

## Sırada Ne Var?

- **Adım 4 — DID:** W3C Verifiable Credentials ile kimlik katmanı
- **Adım 5 — Quorum:** 4 node'lu özel blockchain ağı
- **Adım 6 — app-bridge:** tüm katmanları birbirine bağlayan orkestrasyon
- **Adım 7 — benchmarks:** TPS, latency, F1-score ölçümleri
- **Adım 8 — baseline-central:** H1 hipotezi için merkezi sistem karşılaştırması

---

## Adım 4 — DID / Verifiable Credentials ✓

### Ne yapıyor?
Her aktöre (otorite, afetzede, doğrulayıcı) W3C standardına uygun DID atanıyor. Otorite, ZKP'den gelen commitment değerini kullanarak afetzede adına imzalı bir Verifiable Credential veriyor. Doğrulayıcı taraf VC'yi açık anahtarla doğrulayıp commitment'ın blockchain kaydıyla eşleşip eşleşmediğini kontrol ediyor. **Kişisel veri (yaş, ihtiyaç skoru) bu adımda da görünmüyor.**

(bizdeki DID ve VC yapısı, gerçek sistemlerde de kullanılan evrensel formata uyuyor. Dolayısıyla ileride Hyperledger Indy / Sovrin gibi gerçek DID altyapısına bağlanmak teknik olarak mümkün olabilir.)

### Dosyalar
| Dosya | İçerik |
|-------|--------|
| `identity/src/did_manager.py` | Ed25519 anahtar çifti + DID Document üretimi |
| `identity/src/vc_issuer.py`   | W3C VC oluşturma ve Ed25519 imzalama |
| `identity/src/vc_verifier.py` | İmza doğrulama + commitment eşleşme kontrolü |
| `identity/demo.py`            | Uçtan uca demonstrasyon |

### Canlı gösterim

```bash
cd identity && .venv/bin/python3.11 demo.py
```

**Çıktı:**
```
[+] DID oluşturuldu (authority): did:disaster:authority-94359e
[+] DID oluşturuldu (victim):    did:disaster:victim-fd207d
[+] VC verildi: vc:disaster:469c39...
    commitment: 12465  |  uygun: True
    imza: ✓  |  commitment: ✓ eşleşiyor
[+] sonuç: GEÇERLİ ✓
Kişisel veri hiçbir adımda görünmedi. H2 hipotezi doğrulandı.
```

### Hipotezlerle bağlantı
| Hipotez | Durum |
|---------|-------|
| H2 | Blockchain + ZKP + DID entegrasyonu tamamlandı → **H2 tam olarak sınanabilir hale geldi ✓** |

---

## demo


**Blockchain ağını başlatma**
```bash
cd contracts
npx hardhat node --port 8545
```


```bash
# 1. Sentetik afetzede verisi
cd data
source .venv/bin/activate
python scripts/generate_ctgan.py
```

```bash
# 2. ZKP kanıtı üret — yaş ve ihtiyaç skoru gizli kalıyor
cd ../zkp-circuits
node generate_proof.js
```

```bash
# 3. Kontratları deploy et ve kanıtı blockchain'e gönder
cd ../contracts
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/submit_proof.js --network localhost

npx hardhat run scripts/query_record.js --network localhost
##Blockchain'deki kaydı sorgulamak istersek kaydettim buraya
```

```bash
# 4. DID oluştur, VC ver ve doğrula
cd ../identity
.venv/bin/python3.11 demo.py
```

Her adımın çıktısında kişisel veri (yaş, ihtiyaç skoru) görünmüyor — sadece commitment değeri ve doğrulama sonucu aktarılıyor.
