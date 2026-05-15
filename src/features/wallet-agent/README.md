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
