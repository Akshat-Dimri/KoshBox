/**
 * KoshBox — Blockchain Utilities
 * SHA-256 hashing and Ethereum-compatible address generation.
 * These are the only crypto primitives used throughout the chain.
 */

"use strict";

const crypto = require("crypto");

/**
 * Compute SHA-256 hash of a string.
 * @param {string} data
 * @returns {string} hex digest
 */
function sha256(data) {
  return crypto.createHash("sha256").update(String(data)).digest("hex");
}

/**
 * Generate a deterministic Ethereum-compatible address from a seed string.
 * When migrating to real EVM: replace this with ethers.Wallet.createRandom()
 * and store the private key securely.
 * @param {string} seed
 * @returns {string} 0x-prefixed 40-char hex address
 */
function generateAddress(seed) {
  const hash = sha256(seed + "koshbox-address-salt");
  return "0x" + hash.substring(0, 40);
}

/**
 * Generate a transaction hash from transaction data.
 * @param {object} tx
 * @returns {string} 0x-prefixed 64-char hex hash
 */
function generateTxHash(tx) {
  const data = tx.from + tx.to + tx.amount + tx.coin + tx.timestamp + Math.random();
  return "0x" + sha256(data);
}

/**
 * Compute the Merkle root of a list of transaction hashes.
 * Simple binary tree — suitable for simulation.
 * @param {string[]} txHashes
 * @returns {string}
 */
function computeMerkleRoot(txHashes) {
  if (!txHashes || txHashes.length === 0) return sha256("empty");
  if (txHashes.length === 1) return txHashes[0];

  const pairs = [];
  for (let i = 0; i < txHashes.length; i += 2) {
    const left = txHashes[i];
    const right = txHashes[i + 1] || txHashes[i];
    pairs.push(sha256(left + right));
  }
  return computeMerkleRoot(pairs);
}

/**
 * Compute a block hash from block fields.
 * @param {object} block
 * @returns {string}
 */
function computeBlockHash(block) {
  const data = [
    block.index,
    block.previousHash,
    block.timestamp,
    block.merkleRoot,
    block.nonce
  ].join("|");
  return sha256(data);
}

/**
 * Generate a short readable transaction ID for UI display.
 * @param {string} fullHash
 * @returns {string} e.g. "0xab12...ef34"
 */
function shortHash(fullHash) {
  if (!fullHash || fullHash.length < 12) return fullHash;
  return fullHash.substring(0, 6) + "..." + fullHash.substring(fullHash.length - 4);
}

module.exports = {
  sha256,
  generateAddress,
  generateTxHash,
  computeMerkleRoot,
  computeBlockHash,
  shortHash
};
