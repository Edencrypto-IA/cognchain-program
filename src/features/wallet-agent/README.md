# CongChain Wallet Agent

This module defines the safety contract for future wallet automation.

The product rule is intentionally strict:

- CongChain may interpret, prepare, simulate, schedule, and notify.
- CongChain may not move funds by itself.
- Every value-moving action must require an explicit wallet signature.
- Scheduled actions must be confirmed in-app first and approved again by wallet at execution time.
- Privacy features must protect user metadata without bypassing user consent.

Phase 1 is policy only. No swap, payment, payroll, or signing flow is executed here.

## Phase 2 core

The Wallet Agent Core turns a user command into a safe intent draft.

It can:

- classify wallet commands into typed intents;
- extract basic entities such as token, SOL amount, target price, recipient, and employee count;
- estimate an initial risk level;
- produce a preview checklist;
- run the safety policy before anything reaches a wallet.

It still cannot:

- execute swaps;
- sign transactions;
- schedule real jobs;
- call DEX APIs;
- move funds.

## Phase 3 preview card

The preview card is a UI-only component for showing a parsed intent before any execution path exists.

It shows:

- intent type;
- network;
- token and value when detected;
- risk label;
- safety checklist;
- wallet-signature disclosure;
- review/dismiss actions.

The card does not call APIs, create transactions, or request wallet signatures.

## Phase 3.1 multilingual detector

The local intent detector is now explicit and auditable before any AI parser is introduced.

It can:

- detect wallet commands in Portuguese, English, Spanish, and French keyword sets;
- return the detected intent, confidence, matched keywords, likely language, and whether the prompt looks financial;
- keep `classifyWalletAgentIntent()` backward compatible for existing callers;
- extract common Solana token symbols, SOL amount, target price, recipient address, and payroll headcount.

It still cannot:

- approve or execute an action;
- call market, DEX, wallet, or scheduler APIs;
- replace the future AI parser for ambiguous natural language.
