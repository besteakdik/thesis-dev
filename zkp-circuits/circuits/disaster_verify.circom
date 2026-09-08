pragma circom 2.0.0;

/*
 * disaster verify devresi
 * =======================
 * bir afetzede kaydının, kişisel verileri (yaş, ihtiyaç skoru) açıklamadan
 * yardım kriterlerini karşıladığını ispatlayan zk-snark devresi.
 *
 * gizli girdiler (private):
 *   age          — bireyin yaşı
 *   needs_score  — ihtiyaç skoru (0-100)
 *   salt         — commitment'ı gizlemek için rastgele büyük sayı
 *
 * açık girdiler (public):
 *   min_age          — minimum yaş eşiği
 *   needs_threshold  — minimum ihtiyaç skoru eşiği
 *   commitment       — Poseidon(age, needs_score, salt) — blockchain'de saklanır
 *
 * devre şunu kanıtlar:
 *   1. age >= min_age
 *   2. needs_score >= needs_threshold
 *   3. commitment = Poseidon(age, needs_score, salt)
 */

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

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

    // aralık kısıtları: age ∈ [0,255], needs_score ∈ [0,127]
    // bu kısıtlar olmadan saldırgan BN254 alan elemanı boyutunda girdi sunabilir;
    // Num2Bits witness üretim aşamasında bu değerlerin n-bit içinde olduğunu zorlar.
    component age_bits   = Num2Bits(8);
    component score_bits = Num2Bits(7);
    age_bits.in   <== age;
    score_bits.in <== needs_score;

    // kısıt 1: age >= min_age
    component age_check = GreaterEqThan(8);
    age_check.in[0] <== age;
    age_check.in[1] <== min_age;

    // kısıt 2: needs_score >= needs_threshold
    component score_check = GreaterEqThan(7);
    score_check.in[0] <== needs_score;
    score_check.in[1] <== needs_threshold;

    // kısıt 3: Poseidon commitment doğrulaması
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== age;
    poseidon.inputs[1] <== needs_score;
    poseidon.inputs[2] <== salt;
    commitment === poseidon.out;

    // her iki koşul da sağlanmalı
    is_eligible <== age_check.out * score_check.out;
}

component main {public [min_age, needs_threshold, commitment]} = DisasterVerify();
