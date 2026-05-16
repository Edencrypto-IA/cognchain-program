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

## Phase 3.7 read-only wallet snapshot

Wallet Agent now reads the active wallet context before showing a financial review.

It can:

- read the connected Phantom/Solflare public address through the Solana wallet adapter;
- read the local CongChain Devnet Sandbox wallet when no external wallet is connected;
- fetch the current SOL balance on Solana Devnet in read-only mode;
- show wallet source and balance inside the review details;
- save the wallet snapshot metadata in local intent history.

It still cannot:

- request a wallet signature;
- build or serialize transactions;
- move funds;
- read private keys or seed phrases.

## Phase 3.8 safe transaction proposal

Wallet Agent now creates an auditable transaction proposal after in-app confirmation.

It can:

- turn a confirmed value-moving intent into a typed proposal;
- show whether the proposal is blocked, incomplete, or ready for a future wallet signature;
- list missing fields such as token, amount, recipient, schedule, or payroll budget;
- estimate a minimal Devnet fee label for user review;
- show safety checks before any wallet payload exists.

It still cannot:

- create a real unsigned transaction payload;
- open the wallet signature modal;
- submit transactions to Solana;
- execute scheduled or autonomous transfers.

## Phase 4.1 Devnet unsigned transaction preparation

Wallet Agent can now prepare a local unsigned Solana Devnet transaction for the safest first execution path.

It can:

- prepare only simple SOL transfer payloads on Solana Devnet;
- require an internally confirmed proposal before preparation;
- require wallet, recipient, amount, and Devnet network;
- serialize an unsigned transaction locally with a recent blockhash;
- show that the payload is not signed and was not submitted.

It still cannot:

- ask Phantom or Solflare for a signature;
- submit a signed transaction;
- build swaps, payroll batches, or privacy transfers;
- execute anything on mainnet.

## Phase 4.2 explicit wallet signature

Wallet Agent can now ask the connected wallet to sign a prepared Devnet transaction.

It can:

- deserialize the prepared unsigned transaction locally;
- request an explicit signature through Phantom/Solflare wallet adapter;
- verify the connected signer matches the transaction origin;
- store the signed transaction as `signed_not_submitted`;
- show clearly that the signed transaction has not been sent to Solana.

It still cannot:

- submit the signed transaction to Devnet;
- sign with the local Devnet Sandbox key;
- sign on behalf of the user;
- bypass wallet approval.

## Phase 4.3 controlled Devnet submission

Wallet Agent can now submit a signed transaction to Solana Devnet after a separate user action.

It can:

- send only a previously signed Devnet transaction;
- use `sendRawTransaction` with preflight enabled;
- store the Devnet signature and Explorer URL;
- show that the transaction was submitted on the test network;
- avoid automatic retries beyond the RPC send configuration.

It still cannot:

- submit anything to mainnet;
- submit unsigned transactions;
- automate scheduled sends;
- hide the transaction hash or network from the user.

## Phase 4.4 Devnet confirmation check

Wallet Agent can now verify the submitted Devnet transaction status on demand.

It can:

- query Solana Devnet signature status by transaction hash;
- show `submitted`, `processed`, `confirmed`, `finalized`, `not_found`, or `error`;
- store slot and confirmation timestamp when available;
- keep confirmation as a manual user-triggered check to avoid background loops.

It still cannot:

- poll forever in the background;
- retry submission automatically;
- treat Devnet confirmation as mainnet settlement;
- hide transaction errors from the user.

## Phase 4.5 transaction journey UI

Wallet Agent now shows a visual transaction journey inside the review panel.

It can:

- map the flow from intent to final confirmation;
- show which steps are complete, active, or pending;
- explain that each value-moving stage requires a visible user action;
- keep all execution logic unchanged while improving user comprehension.

It still cannot:

- change transaction state by itself;
- replace wallet approval;
- hide missing or failed stages.

## Phase 4.6 human chat updates

Wallet Agent now writes clearer chat messages after each transaction stage.

It can:

- explain review, preparation, signature, submission, and confirmation in plain language;
- show short wallet addresses, value, hash, Explorer link, status, and next step;
- remind the user that every stage requires visible approval;
- keep execution logic unchanged while improving trust and comprehension.

It still cannot:

- execute a stage from a message alone;
- hide technical errors;
- imply mainnet execution for Devnet actions.

## Phase 4.7 copy transaction summary

Wallet Agent now provides a local copy action for the current transaction summary.

It can:

- copy intent, network, wallet, recipient, amount, risk, proposal, signature, status, slot, and Explorer URL;
- work entirely in the browser clipboard;
- keep the summary aligned with the visible transaction state.

It still cannot:

- export private keys or secrets;
- copy hidden transaction data;
- change or execute transaction state.

## Phase 4.8 local Devnet receipt

Wallet Agent now saves a local browser receipt after Devnet submission and updates it after confirmation checks.

It can:

- store signature, Explorer URL, wallet, recipient, amount, status, slot, and timestamps in `localStorage`;
- update the same receipt as confirmation moves from submitted to processed, confirmed, or finalized;
- keep a small local receipt history for the current browser;
- avoid storing signed transaction payloads, seed phrases, private keys, or wallet secrets.

It still cannot:

- sync receipts across devices;
- treat local receipts as on-chain proof by themselves;
- save mainnet execution receipts;
- execute or confirm anything without the existing user-triggered flow.

## Phase 4.9 Devnet receipt history

Wallet Agent now shows locally saved Devnet receipts inside the review panel.

It can:

- list recent local receipts with type, signature, status, value, recipient, slot, and saved time;
- copy a clean receipt summary to the clipboard;
- open each receipt directly in Solana Explorer;
- refresh the visible list when the current transaction is submitted or confirmed.

It still cannot:

- prove ownership of local receipt data without checking Solana Explorer;
- sync local receipts across browsers or devices;
- display receipts that were never saved in this browser;
- replace the existing transaction review and wallet approval steps.

## Phase 5.1 local rule vault

Wallet Agent now creates local rule records for confirmed watch, schedule, payroll, and risk intents.

It can:

- save a local rule after explicit in-app confirmation;
- support `PRICE_ALERT`, `SCHEDULE_PAYMENT`, `PAYROLL_BATCH`, and `RISK_CHECK` as manual-review rules;
- store trigger context, action mode, wallet address, confirmation ID, and safety notes in `localStorage`;
- mark every rule as `manual_review` with `canAutoExecute: false`.

It still cannot:

- run a background scheduler;
- sign, submit, buy, sell, or pay from a rule;
- create mainnet automation;
- bypass a future explicit wallet approval.

## Phase 5.2 local rule visibility

Wallet Agent now shows locally saved manual-review rules inside the review panel.

It can:

- list recent local rules with type, trigger, action mode, wallet, creation time, and signature requirement;
- copy a clean rule summary to the clipboard;
- explain that rules are context records for future manual review only;
- refresh the visible list after the current intent is confirmed.

It still cannot:

- run rules in the background;
- trigger notifications by itself;
- prepare, sign, submit, buy, sell, or pay from the rule list;
- treat local rules as backend scheduler jobs.

## Phase 5.3 local rule controls

Wallet Agent now lets the user manage local manual-review rules safely.

It can:

- pause and reactivate a local rule by changing only its browser status;
- remove a local rule from `localStorage`;
- copy the rule summary before making manual decisions;
- keep all rule actions local and reversible except deletion.

It still cannot:

- execute paused or active rules;
- schedule background jobs;
- sign or submit transactions from rule controls;
- recover a removed local rule unless the user recreates it from a new confirmed intent.

## Phase 5.4 rule review context

Wallet Agent now generates a safe operational review context for local rules.

It can:

- open a rule context panel with trigger, action mode, wallet, and operator summary;
- list required manual review checks before any future action;
- list blocked actions that cannot happen from the local rule;
- copy the full review context to the clipboard.

It still cannot:

- turn a rule context into execution;
- prepare, sign, submit, buy, sell, or pay from the context panel;
- bypass paused status or wallet approval;
- treat local context as backend automation.

## Phase 5.5 local rule simulation

Wallet Agent now simulates what a local rule would require if reviewed now.

It can:

- simulate paused, incomplete, and manual-review-ready rule states;
- explain missing data such as target price or schedule time;
- show observations and the next manual step;
- copy a local simulation report.

It still cannot:

- call live market, scheduler, or wallet APIs from the simulation;
- match real-time trigger conditions;
- prepare, sign, submit, buy, sell, pay, or notify automatically;
- replace explicit future user review.

## Phase 5.6 local notification drafts

Wallet Agent now prepares local notification drafts for rules using CongChain chat, future authenticated email, and wallet approval channels.

It can:

- create a `draft_only` alert for a local rule;
- plan delivery first inside CongChain chat;
- include email as a prepared authenticated channel for future account notifications;
- include wallet as a future approval channel only when a rule may require a signature;
- copy the notification draft for review.

It still cannot:

- send notifications automatically;
- send email without a verified/authenticated email channel;
- use Telegram, browser push, or external channels;
- request a wallet signature from a draft;
- execute or submit transactions from notification drafts.

## Phase 5.7 send alert to CongChain chat

Wallet Agent can now send a prepared notification draft into the current CongChain chat.

It can:

- create a local assistant message from a notification draft;
- show rule status, trigger, planned channel, and manual review steps;
- explain when wallet approval would be needed in a future phase;
- explain that email is only prepared and not sent yet;
- keep the alert inside the existing chat history.

It still cannot:

- open the wallet automatically;
- send alerts outside CongChain chat;
- send emails automatically;
- schedule future alerts;
- execute, sign, submit, buy, sell, or pay from the alert.

## Phase 5.8 local notification preferences

Wallet Agent now stores local notification preferences for alert drafts.

It can:

- enable or disable CongChain chat in notification drafts;
- enable or disable prepared email copies;
- enable or disable wallet approval visibility for future value-moving reviews;
- save those preferences in `localStorage` for this browser;
- regenerate alert drafts using the selected local channels.

It still cannot:

- send email automatically;
- verify an email address;
- create a backend notification subscription;
- open wallet approvals from a notification draft;
- execute, sign, submit, buy, sell, or pay from notification preferences.

## Phase 5.9 local alert email target

Wallet Agent can now store a local email target for future alert drafts.

It can:

- collect an alert email inside the local review panel;
- validate the email format in the browser;
- store the email target in `localStorage`;
- show whether the email is locally valid or pending;
- include the email target in copied drafts and chat summaries.

It still cannot:

- verify email ownership through a magic link;
- create an authenticated account session;
- send email automatically;
- connect SMTP or an email provider;
- schedule, sign, submit, buy, sell, or pay from email settings.

## Phase 6.1 email identity layer

CONGCHAIN now has a separate user email identity layer alongside Phantom, Solflare, Devnet Sandbox, and Admin login.

It can:

- create a local email identity session through `/api/auth/email/start`;
- read the current email identity through `/api/auth/email/me`;
- clear the email identity through `/api/auth/email/logout`;
- store the session in a separate signed `cog_user` cookie;
- show Email Identity as an option in the wallet/connect modal;
- keep Admin auth isolated in `cog_admin`.

It still cannot:

- verify email ownership with a magic link;
- send real emails;
- replace Phantom, Solflare, or Devnet Sandbox;
- sign wallet actions;
- recover accounts across devices without a future email delivery provider.

## Phase 6.2 magic link foundation

CONGCHAIN now has an isolated magic link flow for email identity.

It can:

- request a signed magic link through `/api/auth/email/magic/start`;
- verify a magic link through `/api/auth/email/magic/verify`;
- promote the email identity session to `authLevel: email_magic`;
- mark the email session as verified after a valid magic link;
- optionally send the email through Resend when `RESEND_API_KEY` and `AUTH_EMAIL_FROM` or `EMAIL_FROM` are configured;
- keep the existing local email identity flow untouched.

It still cannot:

- require magic link verification for all product access;
- recover historical data across devices automatically;
- send emails without a configured provider;
- connect Phantom embedded wallets;
- move funds, sign transactions, or authorize wallet actions from email alone.

## Phase 6.3 email identity linked to Wallet Agent

Wallet Agent now reads the active `cog_user` email identity and uses it for alert drafts.

It can:

- load `/api/auth/email/me` inside the Wallet Agent review panel;
- prefer the connected account email over a manually typed local email;
- mark whether the email came from `cog_user` or manual local input;
- show whether the `cog_user` session was verified by magic link;
- include email source and verification status in copied notification drafts and chat summaries.

It still cannot:

- send email automatically;
- require email login before using Wallet Agent;
- replace Phantom, Solflare, Devnet Sandbox, or wallet signatures;
- sync alert rules to a backend account database;
- authorize financial actions from email identity alone.

## Phase 6.4 email provider readiness

CONGCHAIN now exposes provider readiness for real magic link delivery.

It can:

- report Resend configuration through `/api/auth/email/provider`;
- show whether real email delivery is ready inside the connect modal;
- keep magic link generation working even when delivery is not configured;
- send real magic links when `RESEND_API_KEY` and `AUTH_EMAIL_FROM` or `EMAIL_FROM` exist;
- mask the sender address in the public provider status response.

Required Railway variables for real delivery:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM` or `EMAIL_FROM`
- optional: `USER_SESSION_SECRET`

It still cannot:

- send email without a configured provider;
- verify email ownership without the user clicking a valid magic link;
- use email to authorize wallet signatures or value movement;
- replace Phantom, Solflare, or Devnet Sandbox.
