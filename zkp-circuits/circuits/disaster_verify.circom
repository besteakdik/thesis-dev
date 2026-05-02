pragma circom 2.0.0;

/*
 * disaster verify devresi
 * =======================
 * bir afetzede kaydının, kişisel verileri (yaş, ihtiyaç skoru) açıklamadan
 * yardım kriterlerini karşıladığını ispatlayan zk-snark devresi.
 *
 * gizli girdiler (private):
 *   age          — bireyin yaşı
 *   needs_score  — ihtiyaç puanı (0-100)
 *   salt         — taahhüt değerini gizlemek için rastgele sayı
 *
 * açık girdiler (public):
 *   min_age          — minimum yaş eşiği (örn. 0 — herkese açık)
 *   needs_threshold  — minimum ihtiyaç puanı eşiği (örn. 30)
 *   commitment       — hash(age + needs_score + salt) — blockchain'de saklanır
 *
 * devre şunu kanıtlar:
 *   1. age >= min_age
 *   2. needs_score >= needs_threshold
 *   3. commitment = age + needs_score + salt  (basitleştirilmiş taahhüt)
 */

include "circomlib/circuits/comparators.circom";

template DisasterVerify() {
    // gizli girdiler
    signal input age;
    signal input needs_score;
    signal input salt;

    // açık girdiler
    signal input min_age;
    signal input needs_threshold;
    signal input commitment;

    // çıktı
    signal output is_eligible;

    // kısıt 1: age >= min_age
    // greatereqthan(n): n bitlik sayılar için >= karşılaştırması
    // 8 bit yeterli: max değer 255 > 99 (max yaş)
    component age_check = GreaterEqThan(8);
    age_check.in[0] <== age;
    age_check.in[1] <== min_age;

    // kısıt 2: needs_score >= needs_threshold
    // 7 bit yeterli: max değer 127 > 100 (max skor)
    component score_check = GreaterEqThan(7);
    score_check.in[0] <== needs_score;
    score_check.in[1] <== needs_threshold;

    // kısıt 3: commitment doğrulaması
    // basitleştirilmiş taahhüt: commitment = age + needs_score + salt
    // gerçek sistemde poseidon hash kullanılır — adım 3'te değiştirilecek
    commitment === age + needs_score + salt;

    // her iki koşul da sağlanmalı
    is_eligible <== age_check.out * score_check.out;
}

component main {public [min_age, needs_threshold, commitment]} = DisasterVerify();
