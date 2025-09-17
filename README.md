# MIDL E2E Test: Overview and Setup

This repository contains an end-to-end test that verifies the full cycle of swaps between BTC and tokens.

The test automatically does the following:

- Connects to a base Bitcoin wallet via mnemonic (Ordinals/Runes address);
- Checks the base wallet balance (minimum 2 BTC);
- Determines assets A and B:
    - If RUNE_* and the corresponding ERC-20 addresses are provided — uses them;
    - If not — mints the rune(s), registers them in MIDL, and obtains the corresponding ERC-20 address;
- Ensures liquidity pools exist:
    - tokenA ↔ BTC;
    - tokenA ↔ tokenB;
      If pools are missing — creates them with parameters from .env (or code defaults);
- Creates a set of test wallets and executes a series of swaps:
    - BTC → tokenA;
    - tokenA → BTC;
    - tokenA → tokenB;
- Compares actual balance changes with predicted values.

Run command: `npm run e2e` (or `pnpm run e2e`).

## Environment Requirements

For local runs you must have the following services up:

- Bitcoin Core/Regtest with auto-mining;
- Mempool API available at MEMPOOL_URL;
- Geth (local EVM) + BTC Observer/Executor (contracts and addresses in .env: EXECUTOR_ADDRESS, UNISWAP_* and WETH);
- Runes indexer (Runehook + API).

## Environment Variables (.env-example in tests/e2e/)

Below is the list of variables, their purpose, and whether they are required. Example file: `tests/e2e/.env-exapmle`.

Required:

- MNEMOMIC — mnemonic of the base Bitcoin wallet (Ordinals). The test won’t start without it.
- GETH_URL — Geth HTTP RPC endpoint.
- MEMPOOL_URL — mempool API HTTP endpoint.
- UNISWAP_ROUTER_ADDRESS — Uniswap V2 router address on EVM.
- UNISWAP_FACTORY_ADDRESS — Uniswap V2 factory address.
- WETH — WETH token address.
- EXECUTOR_ADDRESS — Executor contract address.

Optional (may be omitted):

- RUNE_A_ID — ID of rune A (format `block_height:tx_index`, e.g. `5540:3`). If not set — the test will mint a new rune.
- RUNE_B_ID — ID of rune B. If not set — the test will mint a new rune.
- TOKEN_A_ERC20 — ERC-20 address corresponding to RUNE_A_ID. If not set — a mapping in MIDL will be created and the
  address obtained.
- TOKEN_B_ERC20 — ERC-20 address corresponding to RUNE_B_ID. Same as above.
- TEST_WALLETS — number of additional test wallets. Default: 1.
- MULTISIG_ADDRESS — multisig address to use for the transaction, if not provided, the default multisig address for the
  current network will be used.

Liquidity parameters (optional, override code defaults):

- BTC_POOL_SATOSHI_AMOUNT — amount of satoshis for the tokenA ↔ BTC pool when created. Default: 100000000 (1 BTC).
- BTC_POOL_TOKENS_AMOUNT — amount of token A (integer units before multiplying by 10^18) for the tokenA ↔ BTC pool.
  Default: 120000.
- TOKEN_TO_TOKEN_POOL_A_AMOUNT — amount of token A (integer units before multiplying by 10^18) for the tokenA ↔ tokenB
  pool. Default: 100.
- TOKEN_TO_TOKEN_POOL_B_AMOUNT — amount of token B (integer units before multiplying by 10^18) for the tokenA ↔ tokenB
  pool. Default: 200000.

Units note: in code, token values are multiplied by 10^18 to convert to a wei-like format.

## How to Run

1. Install dependencies: `pnpm i`.
2. Copy `tests/e2e/.env-exapmle` → `./.env` and adjust values if needed.
3. Make sure all required services are reachable at the addresses specified in .env.
4. Run the test: `pnpm run e2e`.

The logs will show before/after balances, predicted swap results, and transaction hashes.

## Security

- Do not use a real mnemonic or real funds in this environment.
- Do not commit private data (.env) to VCS.