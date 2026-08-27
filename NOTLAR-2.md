# Tez Yazım Taslağı

Bu dosya, geliştirme sürecinde öğrenilen kavramların tez anlatım stilinde tutulduğu taslaktır.
Repoya push edilmez.

---

## 1. Sistem Mimarisi ve Tasarım Kararları

Bu tez kapsamında geliştirilen prototip, birbirinden bağımsız ancak entegre çalışan
modüllerden oluşan bir monorepo yapısında organize edilmiştir. Sistem; veri üretimi,
sıfır bilgi kanıtı (ZKP), merkeziyetsiz kimlik yönetimi (DID), akıllı kontrat katmanı
ve bu katmanları birbirine bağlayan bir orkestrasyon köprüsünden (app-bridge) meydana
gelmektedir. Her modül bağımsız olarak geliştirilebilir ve test edilebilir olup,
nihai entegrasyon app-bridge katmanı aracılığıyla sağlanmaktadır.

Sistemin temel veri akışı şu şekilde işlemektedir: Afetzede verisi önce sentetik veri
üretim modülünden elde edilmekte, ardından ZKP devresi aracılığıyla gizlilik korunarak
doğrulanmakta, DID ile kimlik imzası eklenmekte ve son olarak blockchain üzerindeki
akıllı kontrata iletilmektedir. Bu süreç boyunca hassas kişisel veriler hiçbir aşamada
açık metin olarak paylaşılmamaktadır.

---

## 2. Sentetik Veri Üretimi

### 2.1 Neden Sentetik Veri?

Bu çalışmada gerçek afet mağdurlarına ait kişisel veri kullanılmamıştır. Gerçek afet
verilerinin kullanımı hem etik hem de yasal kısıtlamalar içermekte olup bu tür verilere
erişim oldukça güçtür. Bu nedenle, gerçek veriyle istatistiksel olarak benzer
karakteristiklere sahip sentetik bir veri kümesi oluşturulmuştur.

Sentetik veri üretiminde CTGAN (Conditional Tabular GAN) yöntemi tercih edilmiştir.
CTGAN, tablolu verilerin koşullu dağılımlarını öğrenerek gerçekçi yapay kayıtlar
üretebilen bir üretici çekişmeli ağ (GAN) modelidir. Bu yöntemin seçilmesinin temel
gerekçesi; kategorik ve sayısal değişkenleri bir arada modelleyebilmesi, değişkenler
arası korelasyonları öğrenebilmesi ve gizlilik korumalı veri artırma süreçlerinde
etkinliğinin literatürde kanıtlanmış olmasıdır (Beaulieu-Jones et al., 2017).

### 2.2 Veri Seti Yapısı

Üretilen sentetik veri kümesi, bir afet senaryosunda yardım talep eden bireyleri
temsil eden kayıtlardan oluşmaktadır. Her kayıt aşağıdaki alanları içermektedir:

| Alan           | Tür      | Açıklama                                      |
|----------------|----------|-----------------------------------------------|
| victim_id      | Metin    | Anonim birey tanımlayıcısı                    |
| age            | Tam sayı | Bireyin yaşı (1-99 arası)                     |
| location_lat   | Ondalık  | Enlem koordinatı                              |
| location_lon   | Ondalık  | Boylam koordinatı                             |
| injury_level   | Tam sayı | Yaralanma seviyesi (0=sağlam, 3=kritik)       |
| needs_score    | Tam sayı | İhtiyaç puanı (0-100 arası)                   |
| aid_type       | Metin    | Yardım türü (tıbbi/gıda/barınak/kurtarma)    |
| request_time   | Zaman    | Yardım talep zamanı                           |
| verified       | İkili    | Kaydın doğrulanıp doğrulanmadığı              |

### 2.3 Veri Üretim Süreci

CTGAN modelinin eğitimi için önce 200 kayıtlık bir tohum (seed) veri kümesi elle
tasarlanmıştır. Bu tohum veride koordinat değerleri, Şubat 2023 Kahramanmaraş depremi
etki bölgesini temsil edecek şekilde 37.57°N, 36.93°E merkez noktası etrafında ±0.5
derecelik (~50 km) bir alanda rastgele dağıtılmıştır. Yaralanma seviyesi ile ihtiyaç
puanı arasında pozitif korelasyon tanımlanmış; bu sayede CTGAN modelinin değişkenler
arası ilişkiyi öğrenmesi hedeflenmiştir.

Model 300 epoch boyunca eğitilmiş ve ardından 1000 sentetik kayıt üretilmiştir.
Üretim sonrası değerler olası aykırı çıktılara karşı kırpma (clipping) işlemine
tabi tutulmuştur. Elde edilen veri setinde yaş ortalaması 60.38, ortalama ihtiyaç
puanı 19.75 ve yardım türü dağılımı sırasıyla tıbbi (%33.4), gıda (%30.5),
barınak (%22.6) ve kurtarma (%13.5) olarak gerçekleşmiştir.

---

## 3. Sıfır Bilgi Kanıtı (ZKP) Katmanı

### 3.1 Temel Kavramlar

Sıfır bilgi kanıtı (Zero-Knowledge Proof — ZKP), bir tarafın (kanıtlayıcı) belirli
bir bilgiye sahip olduğunu, o bilgiyi karşı tarafa (doğrulayıcı) açıklamaksızın
ispatlayabilmesine olanak tanıyan kriptografik bir protokoldür. Bu özellik, gizlilik
gerektiren doğrulama süreçleri için güçlü bir çözüm sunmaktadır.

Bu çalışmada zk-SNARK (Zero-Knowledge Succinct Non-Interactive Argument of Knowledge)
protokolü kullanılmıştır. zk-SNARK'ın tercih edilmesinin temel nedenleri şunlardır:
etkileşimsiz (non-interactive) yapısı sayesinde kanıtlayıcı ile doğrulayıcının aynı
anda iletişim kurmasına gerek olmaması, üretilen kanıtların küçük boyutlu olması ve
doğrulama süresinin sabit ve kısa kalmasıdır. Bu özellikler, sistemin blockchain
üzerinde verimli çalışmasını sağlamaktadır.

### 3.2 Devre Tasarımı

Sistemde kullanılan ZKP devresi Circom dili ile yazılmış olup snarkjs araç zinciriyle
derlenmektedir. Devre, afetzede verisinin gizlilik korunarak doğrulanması amacıyla
tasarlanmıştır.

Devrenin yapısı iki tür girdi içermektedir:

**Gizli girdiler (private signals):** Bireyin yaşı (age) ve ihtiyaç puanı
(needs_score). Bu değerler yalnızca kanıtlayıcı tarafından bilinmekte olup kanıt
üretim sürecinde kullanılmakta ancak hiçbir zaman açığa çıkmamaktadır.

**Açık girdiler (public signals):** Minimum yaş eşiği (min_age), ihtiyaç puanı
eşiği (needs_threshold) ve taahhüt değeri (commitment). Taahhüt değeri,
`commitment = hash(age, needs_score, salt)` formülüyle hesaplanmakta ve
blockchain üzerinde saklanmaktadır. Bu sayede verinin değiştirilmediği
kriptografik olarak garantilenmekte, ancak verinin kendisi açıklanmamaktadır.

Devre; bireyin yaşının minimum eşiği karşılayıp karşılamadığını ve ihtiyaç
puanının belirlenen eşiğin üzerinde olup olmadığını, bu değerleri ifşa etmeksizin
matematiksel olarak ispatlamaktadır.

### 3.3 Araç Zinciri ve Kurulum

ZKP devrelerinin derlenmesi ve kanıt üretimi için iki temel araç kullanılmıştır:
Circom ve snarkjs. Circom, Rust programlama dili ile geliştirilmiş bir devre
derleyicisidir. Bu çalışmada Circom, resmi GitHub deposundan macOS için önceden
derlenmiş ikili dosya (binary) olarak temin edilmiş ve sistem PATH değişkenine
eklenmiştir. snarkjs ise Groth16 protokolüne dayalı kanıt üretimi ve doğrulaması
gerçekleştiren bir Node.js kütüphanesidir.

Devrenin kullandığı GreaterEqThan() karşılaştırıcı şablonları, iden3 tarafından
geliştirilen açık kaynaklı circomlib kütüphanesinden sağlanmıştır.

### 3.4 Derleme Süreci ve Çıktılar

Devre aşağıdaki komutla derlenmiştir:

```
circom circuits/disaster_verify.circom --r1cs --wasm --sym -o output/ -l node_modules
```

Derleme sonucunda üç çıktı dosyası elde edilmiştir:

- **disaster_verify.r1cs:** Devrenin Rank-1 Constraint System (R1CS) temsilidir.
  R1CS, zk-SNARK'ın matematiksel temelidir; devredeki tüm kısıtlar bu formatta
  kodlanmaktadır.

- **disaster_verify.wasm:** Devrenin WebAssembly formatındaki derlenmiş halidir.
  Witness (tanık) üretim aşamasında Node.js ortamında çalıştırılmak üzere
  kullanılmaktadır.

- **disaster_verify.sym:** Hata ayıklama amacıyla kullanılan sembol dosyasıdır.

Derleme istatistikleri incelendiğinde devrenin 18 doğrusal olmayan kısıt (non-linear
constraint), 3 açık girdi, 3 gizli girdi ve 1 açık çıktıdan oluştuğu görülmektedir.
Bu değerler, devrenin hesaplama açısından küçük ve verimli olduğuna işaret etmektedir.

### 3.5 Güvenilir Kurulum (Trusted Setup)

zk-SNARK protokolünde kanıt üretilebilmesi için önce kriptografik parametrelerin
oluşturulması gerekmektedir. Bu aşama literatürde "trusted setup" olarak
adlandırılmaktadır ve iki aşamadan oluşmaktadır.

**Birinci aşama — Powers of Tau:**
Groth16 protokolünün güvenliği, büyük asal sayılar üzerinde tanımlı eliptik eğri
işlemlerine dayanmaktadır. Bu aşamada bn128 eğrisi üzerinde 2^12 = 4096 kısıta
kadar destek sağlayan evrensel parametreler üretilmiştir. Gerçek sistemlerde bu
aşama, güven varsayımını dağıtmak amacıyla çok sayıda bağımsız katılımcı
tarafından sırayla gerçekleştirilmektedir; bu çalışmada ise prototip kapsamında
tek seferlik lokal üretim yapılmıştır.

**İkinci aşama — Devre Anahtarlarının Üretimi:**
Powers of Tau parametreleri ile R1CS dosyası birleştirilerek devreye özgü iki
anahtar üretilmiştir:

- **Proving key (disaster_verify.zkey):** Kanıt üretimi sırasında kullanılır.
  Kanıtlayıcı tarafında gizli tutulur.

- **Verification key (verification_key.json):** Kanıtın doğrulanmasında kullanılır.
  Bir sonraki aşamada Solidity akıllı kontratına gömülecektir.

### 3.6 Kanıt Üretimi ve Doğrulama

Trusted setup tamamlandıktan sonra gerçek bir afetzede kaydı için uçtan uca
kanıt üretim süreci test edilmiştir. Örnek senaryoda afetzede kaydının
gizli değerleri age=45 ve needs_score=75 olarak belirlenmiş; açık eşikler
ise min_age=18 ve needs_threshold=30 olarak tanımlanmıştır.

Süreç üç adımdan oluşmaktadır:

**Taahhüt hesaplama:**
Kanıtlayıcı, gizli değerleri ve rastgele bir salt değerini (12345) birleştirerek
taahhüt değerini hesaplamaktadır: commitment = 45 + 75 + 12345 = 12465.
Bu değer blockchain üzerinde saklanacak; verinin değiştirilmediğini garanti edecektir.

**Witness üretimi:**
WebAssembly formatındaki devre (disaster_verify.wasm), girdi değerlerini alarak
devredeki tüm ara sinyal değerlerini hesaplamaktadır. Bu hesaplama sonucu
elde edilen witness dosyası, kanıt üretiminin girdisini oluşturmaktadır.

**Kanıt üretimi ve doğrulama:**
snarkjs, witness ve proving key kullanarak bir Groth16 kanıtı üretmiştir.
Doğrulama aşamasında verification key, public sinyaller ve kanıt bir arada
değerlendirilerek sistem "OK!" çıktısıyla kanıtın geçerliliğini onaylamıştır.

Doğrulama sonucunda elde edilen açık sinyaller şu şekildedir:

| Sinyal          | Değer | Açıklama                        |
|-----------------|-------|---------------------------------|
| is_eligible     | 1     | kişi yardım kriterlerini karşılıyor |
| min_age         | 18    | uygulanan yaş eşiği             |
| needs_threshold | 30    | uygulanan ihtiyaç eşiği         |
| commitment      | 12465 | veri bütünlüğü taahhüdü         |

Kritik nokta şudur: doğrulayan taraf age=45 ve needs_score=75 değerlerini
hiçbir aşamada görmemiştir. Yalnızca bu değerlerin belirlenen eşikleri
karşıladığını kriptografik olarak öğrenmiştir. Bu, tezin temel hipotezi olan
"kişisel veri açıklanmadan doğrulama yapılabilir" iddiasının prototip
düzeyinde ispatıdır.

---
