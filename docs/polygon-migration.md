# KoshBox — Polygon Migration Guide

## Overview

KoshBox Testnet is a drop-in simulation of an EVM-compatible blockchain. Migrating to Polygon Amoy (testnet) or Polygon Mainnet requires changes only at the integration boundary. This guide documents every change required.

---

## Target Networks

| Network | Chain ID | RPC URL | Currency |
|---|---|---|---|
| Kosh Testnet (current) | 99991 | Local simulation | KOSH |
| Polygon Amoy (testnet) | 80002 | `https://rpc-amoy.polygon.technology` | POL |
| Polygon Mainnet | 137 | `https://polygon-rpc.com` | POL |

---

## Step 1: Deploy Smart Contract

Create `contracts/KoshPayment.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract KoshPayment {
    event PaymentReceived(
        address indexed merchant,
        address indexed sender,
        uint256 amount,
        string senderName,
        uint256 timestamp
    );

    function pay(
        address merchant,
        string calldata senderName
    ) external payable {
        require(msg.value > 0, "Amount required");
        (bool sent, ) = merchant.call{value: msg.value}("");
        require(sent, "Transfer failed");
        emit PaymentReceived(merchant, msg.sender, msg.value, senderName, block.timestamp);
    }
}
```

Deploy to Polygon Amoy using Hardhat or Foundry.

---

## Step 2: Backend Changes

### `backend/config.js`

```js
// Change from:
blockchain: {
  networkId: "kosh-testnet-1",
  blockTime: 3000,
}

// Change to:
blockchain: {
  networkId: "polygon-amoy",
  chainId: 80002,
  rpcUrl: "https://rpc-amoy.polygon.technology",
  contractAddress: "0xYourDeployedContractAddress",
  merchantPrivateKey: process.env.MERCHANT_PRIVATE_KEY
}
```

### Replace `backend/blockchain/chain.js`

Replace the simulation chain with an ethers.js RPC client:

```js
const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
const wallet = new ethers.Wallet(config.blockchain.merchantPrivateKey, provider);
```

### Replace `backend/blockchain/wallets/wallet-manager.js`

```js
const { ethers } = require("ethers");

function generateWallet() {
  return ethers.Wallet.createRandom();
}
```

---

## Step 3: Frontend Changes

### Replace `frontend/scripts/components/blockchain.js`

Replace local mock calls with ethers.js provider:

```js
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.7.esm.min.js";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
```

---

## What Does NOT Change

- All UI components
- Transaction flow controller
- Audio engine and announcements
- Device state machine
- Battery and network simulation
- QR module
- Demo mode sequencer
- All CSS and layout

The payment flow wiring, the merchant experience, and all simulator features are fully preserved.

---

## Estimated Migration Time

| Task | Estimated Hours |
|---|---|
| Smart contract development + testing | 4–8 hours |
| Backend RPC integration | 2–4 hours |
| Frontend ethers.js integration | 2–3 hours |
| End-to-end testing on Amoy | 2–4 hours |
| **Total** | **10–19 hours** |
