# KoshBox — Blockchain Design

## Overview

KoshBox runs on **Kosh Testnet** — a purpose-built simulated blockchain that replicates the behaviour of an EVM-compatible payment network without requiring real infrastructure. It is designed to be a drop-in replacement for Polygon Amoy testnet or Polygon Mainnet, requiring only a single configuration swap and a contract deployment to migrate.

---

## Network Identity

| Property | Value |
|---|---|
| Network Name | Kosh Testnet |
| Network ID | `kosh-testnet-1` |
| Chain ID | `99991` (simulated) |
| Currency Symbol | `KOSH` |
| Block Time | 3 seconds (simulated) |
| Confirmations Required | 2 |
| Consensus | Simulated PoA (Proof of Authority) |

---

## Block Structure

```js
{
  index: 4,
  timestamp: 1718000000000,
  previousHash: "0000a3f8...",
  hash: "0000b7c2...",
  nonce: 1042,
  difficulty: 2,
  transactions: [
    {
      hash: "0xab12...",
      from: "0xMerchantAddress",
      to: "0xCustomerAddress",
      amount: "150.00",
      coin: "KOSH",
      senderName: "Rahul",
      timestamp: 1718000000000,
      status: "confirmed",
      blockIndex: 4,
      confirmations: 2
    }
  ],
  merkleRoot: "0xdeadbeef..."
}
```

---

## Transaction Lifecycle

```
CREATED
   │
   ▼
PENDING        ← Submitted by customer, in mempool
   │
   ▼
CONFIRMING     ← Picked up by block builder, block being mined
   │
   ▼
CONFIRMED      ← Included in a block with ≥ confirmationsRequired
   │
   ▼
ANNOUNCED      ← Soundbox audio triggered, merchant notified
```

### Status Codes

| Code | Meaning |
|---|---|
| `pending` | In mempool, not yet in a block |
| `confirming` | Block being built (simulated mining delay) |
| `confirmed` | In at least one block |
| `finalized` | Has ≥ 2 block confirmations |
| `failed` | Rejected (insufficient balance, invalid format) |

---

## Wallet Structure

Each wallet is represented as:

```js
{
  address: "0x742d35Cc6634C0532925a3b8D4C9b7F3a7C2F1E",
  label: "Merchant Wallet",
  type: "merchant" | "customer" | "system",
  balance: {
    KOSH: "10000.00",
    ETH: "0.00"    // reserved for future EVM migration
  },
  nonce: 0,
  createdAt: 1718000000000
}
```

### Address Generation

Addresses are deterministically generated from a seed string using SHA-256:

```js
function generateAddress(seed) {
  const hash = sha256(seed);
  return "0x" + hash.substring(0, 40);
}
```

This produces Ethereum-compatible address format. When migrating to real EVM chains, real private keys and `ethers.js` wallet generation replace this function — no other code changes.

---

## Chain Integrity

Blocks are linked by including the previous block's hash in each new block. The chain is valid if:

```
block[n].previousHash === block[n-1].hash
```

The genesis block has `previousHash: "0000000000000000000000000000000000000000"`.

Block hashes are computed as:

```js
sha256(
  block.index +
  block.previousHash +
  block.timestamp +
  JSON.stringify(block.transactions) +
  block.nonce
)
```

Difficulty is simulated — the chain does not require proof-of-work, but the hash is computed to maintain structural authenticity for demonstrations.

---

## Coin Types

The simulator supports multiple coin types. Each is defined in `backend/blockchain/coins.js`:

```js
{
  KOSH: {
    symbol: "KOSH",
    name: "Kosh Token",
    decimals: 2,
    type: "native"
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 6,
    type: "evm-compatible"
  },
  MATIC: {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 6,
    type: "evm-compatible"
  }
}
```

New coins can be added to this registry without changing transaction logic.

---

## Mempool Design

The transaction pool (`transaction-pool.js`) manages pending transactions:

- Max pool size: 100 transactions (configurable)
- Oldest pending transactions are picked first (FIFO)
- Block builder takes up to 10 transactions per block
- Transactions expire after 5 minutes if not confirmed (configurable)

```
Mempool
 ├── pending[]     ← Waiting for next block
 ├── confirming[]  ← Currently being mined
 └── expired[]     ← Timed out (retained for history)
```

---

## Block Builder

The block builder runs on a timer interval (default 3 seconds):

```
1. Check mempool for pending transactions
2. If empty → skip (no empty blocks mined)
3. Move pending → confirming
4. Simulate mining delay (500ms - 1500ms random)
5. Compute block hash
6. Add block to chain
7. Move confirming → confirmed
8. Persist chain to JSON
9. Emit "block_confirmed" event
```

The simulated mining delay creates the realistic "confirming..." animation in the UI.

---

## API Endpoints

### POST `/api/transactions/submit`

Submit a new payment transaction.

Request:
```json
{
  "merchantAddress": "0x742d35...",
  "amount": "150.00",
  "coin": "KOSH",
  "senderName": "Rahul",
  "senderAddress": "0xabc123..."
}
```

Response:
```json
{
  "txHash": "0xab12cd34...",
  "status": "pending",
  "timestamp": 1718000000000,
  "estimatedConfirmation": 6000
}
```

### GET `/api/transactions/status/:txHash`

Poll transaction status.

Response:
```json
{
  "txHash": "0xab12cd34...",
  "status": "confirmed",
  "blockIndex": 4,
  "confirmations": 2,
  "amount": "150.00",
  "coin": "KOSH",
  "senderName": "Rahul"
}
```

### GET `/api/transactions/history`

Recent transaction history (last 50).

### GET `/api/blockchain/status`

Chain health and latest block info.

Response:
```json
{
  "networkId": "kosh-testnet-1",
  "latestBlock": 42,
  "latestBlockHash": "0000b7c2...",
  "pendingTransactions": 1,
  "totalTransactions": 87,
  "uptime": 3600000
}
```

### GET `/api/blockchain/blocks?limit=10`

Recent blocks.

---

## Simulated Network Conditions

The network simulator can inject the following conditions:

| Condition | Effect on Transactions |
|---|---|
| Connected | Normal confirmation speed |
| Weak Signal | Block time increased to 8–15 seconds |
| Disconnected | Transactions queued locally, submitted on reconnect |
| Reconnecting | Intermittent — some blocks confirm, some timeout |

When disconnected, the UI shows a queued transaction indicator and the soundbox announces "Network disconnected" in the selected language.

---

## Future: Polygon Migration

See [`docs/polygon-migration.md`](polygon-migration.md) for the complete migration guide.

**Summary of changes required:**

| Component | Change |
|---|---|
| `backend/blockchain/chain.js` | Replace with Polygon RPC client |
| `backend/blockchain/wallets/wallet-manager.js` | Replace with `ethers.js` wallet |
| `frontend/scripts/components/blockchain.js` | Replace with Web3/ethers provider |
| `backend/config.js` | Set `rpcUrl`, `chainId`, `contractAddress` |
| Smart contract | Deploy `KoshPayment.sol` to Polygon Amoy |

The transaction flow, UI, audio engine, and device twin require **no changes**.
