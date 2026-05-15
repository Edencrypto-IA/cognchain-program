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

## Phase 3.2 chat preview card

The main chat can now surface a Wallet Agent preview card when the local detector recognizes a financial command.

It can:

- show the parsed intent directly in the chat;
- explain risk, network, token, value, checklist, and wallet-signature requirements;
- keep normal chat streaming untouched for non-financial prompts;
- stop before execution and only show a safe review path.

It still cannot:

- submit swaps, payments, payroll, schedules, or private transfers;
- request a wallet signature;
- perform background automation.

## Phase 3.3 review details

The preview card can now open a detailed review panel.

It can:

- show the original command, detected intent, network, wallet, token, amount or target condition;
- separate ready, missing, and review-needed fields;
- explain custody and signature requirements;
- list the steps required before execution;
- list actions that CongChain must never perform automatically.

It still cannot:

- confirm the intent internally;
- prepare or sign a transaction;
- persist the draft to backend history.

## Phase 3.4 AI parser with local fallback

Wallet Agent now has an optional AI parser behind `/api/wallet-agent/parse`.

It can:

- ask the selected model to return a strict JSON intent draft;
- enrich detected fields such as token, amount, target price, recipient, schedule, and payroll count;
- attach parser source and confidence to the review panel;
- fall back to the local detector if the AI call times out, fails, or returns invalid JSON;
- rate limit parser calls separately from the main chat.

It still cannot:

- approve the parsed intent;
- execute or prepare real transactions;
- trust AI output without review;
- bypass wallet signature requirements.

## Phase 3.5 internal confirmation gate

Wallet Agent now has an explicit in-app confirmation step after review.

It can:

- block confirmation for value-moving intents until a wallet address is present;
- mark a reviewed intent as internally confirmed;
- move value-moving drafts from `intent_preview` to `wallet_signature_required`;
- keep read-only intents as non-signing analysis flows;
- show a confirmation ID in the review panel.

It still cannot:

- open a wallet signature request;
- serialize or prepare a real transaction;
- execute confirmed intents automatically.

## Phase 3.6 local intent history

Wallet Agent now records a safe local history of intent drafts in the browser.

It can:

- store previewed and confirmed intents in `localStorage`;
- update an existing history item when the same draft is confirmed;
- show the most recent local intents inside the review panel;
- keep only a bounded list of recent items to avoid unbounded storage growth.

It still cannot:

- persist intent history to the backend;
- sync history across devices;
- execute or sign any historical intent.
