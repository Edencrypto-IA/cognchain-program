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

## Phase 6.5 account panel

CONGCHAIN now separates account identity from wallet custody in the wallet menu.

It can:

- show the connected email identity inside the wallet dropdown;
- show whether the email is local or verified by magic link;
- let the user disconnect only the email session through `/api/auth/email/logout`;
- keep wallet disconnect separate from email logout;
- explain that email handles identity/alerts while wallets handle signatures/funds.

It still cannot:

- use email logout to disconnect Phantom, Solflare, or Devnet Sandbox;
- use wallet disconnect to remove the email identity;
- authorize financial actions through email identity;
- sync account preferences to backend storage.

## Phase 7.1 alert delivery contract

Wallet Agent now has a typed delivery contract for future real alerts.

It can:

- convert a notification draft into a `WalletAgentAlertDelivery`;
- represent delivery status as `draft`, `queued`, `sent`, `failed`, or `cancelled`;
- evaluate chat, email, and wallet channels separately;
- mark email as ready only when a valid email target exists;
- keep wallet approval as pending/blocked and never as an executable alert action;
- declare hard safety flags: no transaction execution and no scheduling in this phase.

It still cannot:

- create alert records through an API;
- send email;
- queue background jobs;
- request wallet signatures from alerts;
- execute, sign, submit, buy, sell, or pay from alerts.

## Phase 7.2 alert delivery API

Wallet Agent now has a safe API for creating alert delivery contracts from approved local drafts.

It can:

- accept a notification draft and local rule through `POST /api/wallet-agent/alerts`;
- validate that the draft belongs to the rule;
- return a `WalletAgentAlertDelivery` contract with channel readiness;
- show that contract in the review panel;
- rate limit alert contract creation.

It still cannot:

- persist alert delivery records;
- send email;
- queue or schedule a background job;
- request wallet signatures from alerts;
- execute, sign, submit, buy, sell, or pay from alerts.

## Phase 7.3 manual email delivery

Wallet Agent can now send an alert email only after the user explicitly clicks the manual send button.

It can:

- call `POST /api/wallet-agent/alerts/send-email` with an existing safe delivery contract;
- require an email channel with `ready` status and a valid target;
- require `RESEND_API_KEY` and `AUTH_EMAIL_FROM` or `EMAIL_FROM` before real delivery;
- return the delivery contract as `sent` after the provider accepts the email;
- show success or provider configuration errors inside the review panel.

It still cannot:

- send email automatically from a rule or draft;
- queue or schedule future emails;
- request wallet approvals from email delivery;
- execute, sign, submit, buy, sell, or pay from alerts;
- persist alert delivery records to backend storage.

## Phase 7.4 local alert email receipts

Wallet Agent now saves local receipts after a manual alert email is sent.

It can:

- create a local browser receipt from a sent `WalletAgentAlertDelivery`;
- store delivery ID, rule ID, draft ID, target email, provider, title, message, and timestamps;
- show recent alert email receipts inside the review panel;
- copy a clean receipt summary to the clipboard;
- keep receipts bounded in `localStorage`.

It still cannot:

- prove email delivery outside the provider response;
- sync alert receipts across devices;
- persist alert delivery records to backend storage;
- schedule future alerts;
- request wallet approvals or execute transactions from receipts.

## Phase 7.5 local alert failure receipts

Wallet Agent now records local receipts when manual alert email delivery fails.

It can:

- save a local failed receipt when the email provider is missing or rejects the send;
- store the attempted target, provider, rule ID, delivery ID, title, message, failure reason, and timestamp;
- show failed attempts beside successful email receipts;
- copy a failed delivery receipt for support or operator review;
- avoid silent failures in the review panel.

It still cannot:

- retry failed emails automatically;
- prove provider-side delivery after a failure;
- schedule a retry;
- send fallback notifications through another channel;
- request wallet approvals or execute transactions from failed receipts.

## Phase 7.6 local alert status center

Wallet Agent now summarizes local alert email delivery history inside the review panel.

It can:

- count manual alert emails sent in this browser;
- count unique email targets;
- show which provider accepted the sent alerts;
- show the latest local send timestamp;
- keep the status center derived only from local receipts.

It still cannot:

- prove inbox delivery or email opens;
- sync delivery status across devices;
- create backend delivery analytics;
- retry failed emails automatically;
- schedule, sign, submit, buy, sell, or pay from alert status.

## Phase 8.1 backend persistence contract

Wallet Agent now has a backend persistence contract for future account-owned alert records.

It can:

- create a typed `WalletAgentAlertPersistenceRecord`;
- accept a delivery contract and optional local receipt through `POST /api/wallet-agent/alert-records`;
- attach the current `cog_user` email identity as metadata when available;
- report whether a future persistence backend is configured;
- return `contract_only` mode when no database adapter is enabled.

It still cannot:

- write alert records to a real database;
- sync local receipts across devices;
- use persistence to send or retry emails;
- schedule future alerts;
- store secrets, wallet keys, signed payloads, or execute transactions.

## Phase 8.2 user-owned alert record handoff

Wallet Agent now connects manual alert email results to the account-owned persistence contract.

It can:

- call `POST /api/wallet-agent/alert-records` after a manual email send succeeds or fails;
- attach the local sent/failed receipt to the backend persistence contract;
- show whether the record is linked to the current `cog_user` email identity;
- show whether the account email is verified;
- explain whether the response is still `contract_only` instead of durable storage.

It still cannot:

- write account alert history to a database;
- recover local receipts from another device;
- resend failed emails automatically;
- schedule future alerts;
- use account history to request wallet signatures or execute transactions.

## Phase 8.3 server-side alert receipt API

Wallet Agent now has a server-side API for account-owned alert receipts.

It can:

- write a receipt through `POST /api/wallet-agent/alert-records/receipts`;
- read receipts through `GET /api/wallet-agent/alert-records/receipts`;
- require a verified `cog_user` email identity before reading or writing;
- store sent and failed alert receipts in bounded server memory;
- keep all stored data metadata-only.

It still cannot:

- provide durable database persistence;
- survive server restarts or serverless cold starts;
- write receipts for unverified email identities;
- resend, retry, schedule, sign, submit, buy, sell, or pay from server receipts;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 8.4 account alert history API

Wallet Agent now has a read-only account alert history API.

It can:

- read summarized history through `GET /api/wallet-agent/alert-records/history`;
- require a verified `cog_user` email identity;
- return totals for sent and failed alert receipts;
- return unique targets, providers, latest event timestamps, and recent receipts;
- keep history derived only from metadata receipts in bounded server memory.

It still cannot:

- provide durable database history;
- sync history after server restarts;
- expose history to unverified email identities;
- modify, retry, resend, schedule, sign, submit, buy, sell, or pay from history;
- store or return wallet secrets, seed phrases, or signed transaction payloads.

## Phase 8.5 account alert history UI

Wallet Agent now shows account-owned alert history when a verified email session is available.

It can:

- load summarized account history from `GET /api/wallet-agent/alert-records/history`;
- fall back to local browser receipts when the user has no verified email session;
- write sent and failed email receipts to the server-side memory receipt API after the account record contract is prepared;
- show whether the receipt panel is using account history or local fallback;
- copy either account receipts or local receipts for operator review.

It still cannot:

- provide durable database history;
- sync history after server restarts;
- show account history to unverified email identities;
- resend, retry, schedule, sign, submit, buy, sell, or pay from history;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 8.6 alert history audit bundle

Wallet Agent now lets operators copy a clean alert history audit bundle.

It can:

- copy a full account alert history summary when verified email history is available;
- copy a local browser alert history summary when account history is unavailable;
- include sent totals, failure totals, unique targets, providers, recent receipts, timestamps, and storage notes;
- preserve the same metadata-only safety boundary as the history APIs;
- make support and audit review easier without adding new execution powers.

It still cannot:

- provide durable database history;
- prove inbox opens or provider-side delivery beyond stored receipt metadata;
- sync local fallback history across devices;
- resend, retry, schedule, sign, submit, buy, sell, or pay from copied history;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 8.7 alert history file export

Wallet Agent now lets operators export the alert history audit bundle as a local text file.

It can:

- download the account alert history bundle as `.txt` when verified email history is available;
- download the local browser fallback bundle as `.txt` when account history is unavailable;
- include timestamps in export filenames for support and audit workflows;
- reuse the same metadata-only content as the copy history action;
- keep export generation fully client-side without adding new backend powers.

It still cannot:

- export durable database history;
- prove inbox opens or provider-side delivery beyond stored receipt metadata;
- sync local fallback exports across devices;
- resend, retry, schedule, sign, submit, buy, sell, or pay from exported files;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 8.8 alert history sync status

Wallet Agent now makes alert history storage status explicit in the review panel.

It can:

- show whether alert history is using local browser fallback, verified account memory, or future durable database mode;
- display origin, persistence mode, and identity in a compact status card;
- explain when server-side history is still bounded memory instead of durable storage;
- keep the export and copy actions aligned with the visible storage source;
- reduce operator confusion without changing alert, wallet, or transaction behavior.

It still cannot:

- provide durable database history until a database adapter is added;
- sync local fallback history across devices;
- turn server memory into permanent storage;
- resend, retry, schedule, sign, submit, buy, sell, or pay from sync status;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 8.9 alert history handoff review

Wallet Agent now has a documented handoff from local alert receipts to account-owned alert history.

Flow summary:

1. A local rule creates a manual notification draft.
2. The user reviews the draft and explicitly sends the alert email.
3. The browser saves a local sent or failed receipt.
4. `POST /api/wallet-agent/alert-records` prepares the account-owned persistence contract.
5. When the user has a verified `cog_user` email session, `POST /api/wallet-agent/alert-records/receipts` stores metadata in bounded server memory.
6. `GET /api/wallet-agent/alert-records/history` returns read-only account history for verified users.
7. The review panel shows account history when available and falls back to local browser receipts otherwise.
8. Operators can copy or export a metadata-only audit bundle.

Safety guarantees:

- alert history is metadata-only;
- unverified email sessions cannot read or write account receipt history;
- local fallback remains browser-only;
- server memory is explicitly labeled as non-durable;
- copied and exported bundles cannot trigger email delivery, wallet signing, scheduling, or transactions;
- no wallet keys, seed phrases, signed payloads, private transaction data, or secrets are stored in alert history.

Phase 9 handoff:

- replace bounded server memory with durable account-scoped database storage;
- add migration-safe storage adapters;
- preserve the same metadata-only schema and verified-email access boundary;
- keep local fallback for offline or unauthenticated users;
- add retention, deletion, and account export policies before production persistence.

It still cannot:

- provide durable database history;
- recover server-memory receipts after restart;
- sync local fallback history across devices;
- resend, retry, schedule, sign, submit, buy, sell, or pay from history;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.1 alert history storage adapter contract

Wallet Agent now has a storage adapter contract for account alert history.

It can:

- route alert receipt reads, writes, and history summaries through a typed storage adapter;
- keep the current bounded memory implementation as the default adapter;
- expose adapter metadata such as storage mode and durability;
- prepare the code path for a future database adapter without changing API contracts;
- keep existing receipt and history endpoints backward compatible.

It still cannot:

- write alert history to a durable database;
- configure a production database adapter through environment variables;
- migrate old memory receipts into persistent storage;
- recover server-memory receipts after restart;
- resend, retry, schedule, sign, submit, buy, sell, or pay from storage records;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.2 alert history database schema

Wallet Agent now has a Prisma schema for durable account alert receipt storage.

It can:

- define `WalletAgentAlertReceipt` as metadata-only durable storage;
- enforce one receipt per `ownerEmail` and `receiptId`;
- index account history by owner email, event time, status, delivery ID, and rule ID;
- store provider, target, title, message, event timestamp, storage metadata, and safety notes;
- preserve explicit safety flags that block secrets, scheduling, and transaction execution.

It still cannot:

- write to the database until the database adapter is connected;
- migrate existing in-memory receipts automatically;
- make local browser fallback durable;
- resend, retry, schedule, sign, submit, buy, sell, or pay from database rows;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.3 alert history environment gate

Wallet Agent now has a safe environment gate for future database alert history storage.

It can:

- detect whether database storage was requested through `WALLET_AGENT_ALERT_HISTORY_STORAGE=database`;
- accept a dedicated `WALLET_AGENT_ALERTS_DATABASE_URL` or the shared `DATABASE_URL` when it is a Postgres URL;
- keep bounded memory as the active adapter until the Prisma database adapter is enabled;
- report whether database storage was requested, configured, adapter-ready, durable, or falling back to memory;
- keep API contracts unchanged while exposing clearer storage reasons.

It still cannot:

- write alert history to the database;
- enable the Prisma adapter automatically;
- treat `WALLET_AGENT_ALERT_PERSISTENCE=enabled` as enough without a valid Postgres URL;
- migrate memory receipts into durable storage;
- resend, retry, schedule, sign, submit, buy, sell, or pay from storage config;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.4 alert history database write path

Wallet Agent now has a gated Prisma write adapter for account alert receipts.

It can:

- enable durable writes only when database storage is requested, a valid Postgres URL exists, and `WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled`;
- upsert metadata-only alert receipts into `WalletAgentAlertReceipt`;
- preserve the existing API response shape while switching storage metadata from memory to database;
- read back the latest account receipts from the database after a write;
- fall back to bounded memory whenever the database adapter gate is not fully enabled.

It still cannot:

- run migrations automatically in this phase;
- migrate existing memory receipts into the database;
- retry failed database writes with a queue;
- expose durable deletion or retention policies;
- resend, retry, schedule, sign, submit, buy, sell, or pay from database rows;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.5 alert history database read path

Wallet Agent now has a database-native read path for durable account alert history.

It can:

- read recent account receipts from `WalletAgentAlertReceipt` when the Prisma adapter is active;
- calculate total, sent, failed, provider, target, and latest-event metrics through database queries;
- keep memory history behavior unchanged when the database adapter gate is disabled;
- return storage-aware messages from the history API;
- preserve the same read-only, metadata-only response contract.

It still cannot:

- run migrations automatically;
- backfill database history from memory receipts;
- paginate beyond the bounded API limit;
- expose durable deletion or retention policies;
- resend, retry, schedule, sign, submit, buy, sell, or pay from database history;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.6 alert history retention policy

Wallet Agent now declares a retention policy for account alert history.

It can:

- expose `retentionDays`, `maxReceiptsPerUser`, and deletion support flags in history responses;
- configure the declared retention window through `WALLET_AGENT_ALERT_HISTORY_RETENTION_DAYS`;
- clamp retention between 7 and 3650 days for safe configuration;
- keep automatic and manual deletion disabled until the explicit deletion API phase;
- make deletion requirements visible before durable storage becomes production-critical.

It still cannot:

- delete durable database rows;
- automatically purge old receipts;
- accept account deletion requests;
- migrate existing memory receipts into a retention-managed store;
- resend, retry, schedule, sign, submit, buy, sell, or pay from retention policy;
- store secrets, wallet keys, seed phrases, or signed transaction payloads.

## Phase 9.7 verified alert history deletion endpoint

Wallet Agent now has an explicit deletion endpoint for account alert history metadata.

Endpoint:

- `POST /api/wallet-agent/alert-records/history/delete`

It requires:

- a verified email session;
- the request to target only the current verified email;
- the confirmation phrase `DELETE ALERT HISTORY`;
- the endpoint-specific rate limit.

It can:

- delete bounded memory alert receipts for the verified email;
- delete durable Postgres alert receipt rows for the verified email when the database adapter is active;
- return a typed deletion receipt with `deletedCount`, storage mode, timestamp, confirmation phrase, and safety notes;
- keep automatic deletion disabled while allowing explicit manual deletion;
- reject cross-account deletion attempts.

It still cannot:

- delete wallet keys, seed phrases, signed payloads, transactions, local browser receipts, rules, or scheduled jobs;
- delete another user's history;
- run automatic retention purges;
- perform account deletion;
- resend, retry, schedule, sign, submit, buy, sell, or pay from deletion requests;
- bypass verified email identity or the confirmation phrase.

## Phase 9.8 alert history retention audit trail

Wallet Agent now records a bounded operational audit trail for alert history deletion actions.

Endpoint:

- `GET /api/wallet-agent/alert-records/history/audit`

It can:

- record rejected deletion attempts for invalid confirmation phrases;
- record rejected cross-account deletion attempts;
- record completed deletion actions with deleted count and storage mode;
- expose recent audit events only to the verified email owner;
- keep audit events metadata-only and bounded to 50 events per verified email.

It intentionally does not store:

- IP addresses;
- wallet keys, seed phrases, or signed payloads;
- transaction payloads;
- alert body secrets;
- private wallet data.

It still cannot:

- persist audit events durably in Postgres;
- export audit events;
- perform automatic retention purges;
- delete account identity;
- resend, retry, schedule, sign, submit, buy, sell, or pay from audit events.

## Phase 9.9 operational runbook for alert history storage

Wallet Agent now has an operational checklist for running alert history safely in production.

Default safe mode:

- `WALLET_AGENT_ALERT_HISTORY_STORAGE=memory`
- `WALLET_AGENT_ALERT_DATABASE_ADAPTER=disabled`
- no durable database writes are attempted;
- alert receipts disappear when the server restarts;
- this is the safest mode for local development, demos, and UI validation.

Durable metadata mode:

- set `WALLET_AGENT_ALERT_HISTORY_STORAGE=database`;
- set `WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled`;
- configure either `WALLET_AGENT_ALERTS_DATABASE_URL` or a shared Postgres `DATABASE_URL`;
- run the Prisma migration/deploy process before enabling the adapter in Railway;
- keep `WALLET_AGENT_ALERT_HISTORY_RETENTION_DAYS` between 7 and 3650 days.

Railway deployment checklist:

- confirm the service has a valid Postgres URL before switching from memory to database;
- confirm Prisma generated client includes `WalletAgentAlertReceipt`;
- deploy with database storage disabled first if the database migration has not been applied;
- enable `WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled` only after the schema exists;
- call `GET /api/wallet-agent/alert-records/history` with a verified email session and confirm `history.storage.durable`;
- create one test email alert receipt and confirm it appears in the history response;
- call `GET /api/wallet-agent/alert-records/history/audit` and confirm only metadata audit events are returned;
- test deletion only with the confirmation phrase `DELETE ALERT HISTORY`.

Rollback plan:

- set `WALLET_AGENT_ALERT_DATABASE_ADAPTER=disabled`;
- keep `WALLET_AGENT_ALERT_HISTORY_STORAGE=database` if you want to preserve the requested mode while falling back safely;
- redeploy the service;
- verify history responses report memory fallback and do not attempt database writes;
- do not drop database tables during rollback unless a separate data-retention decision has been approved.

Safety guarantees:

- history stores alert metadata only;
- deletion affects only the verified email's alert receipt metadata;
- audit events are bounded memory metadata in this phase;
- no wallet keys, seed phrases, signed transactions, private payloads, payroll secrets, or user funds are stored;
- none of the history, deletion, or audit APIs can buy, sell, pay, sign, schedule, resend, or submit transactions.

Known production gaps:

- audit events are not durable yet;
- automatic retention purge is not implemented yet;
- no backfill exists from memory storage into database storage;
- no admin observability dashboard exists yet;
- no export endpoint exists for account-owned alert history.

## Phase 9.10 final alert history hardening review

Wallet Agent Phase 9 closes with alert history storage, retention, deletion, audit, and operations documented as a safe metadata-only layer.

Completed in Phase 9:

- storage adapter contract with memory as the safe default;
- Prisma `WalletAgentAlertReceipt` schema for durable metadata storage;
- environment gate for database mode;
- gated database write path;
- database-native read path;
- retention policy declaration;
- verified-email manual deletion endpoint;
- bounded metadata audit trail;
- operational runbook for Railway, rollback, and safety checks.

Final safety posture:

- default mode remains memory and non-durable unless database mode is explicitly enabled;
- database writes require a valid Postgres URL and `WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled`;
- history reads require verified email identity;
- deletion requires verified email identity and the confirmation phrase `DELETE ALERT HISTORY`;
- deletion is account-scoped and only removes alert receipt metadata for the verified email;
- audit events do not store IP addresses, wallet secrets, signed payloads, transaction payloads, or private wallet data;
- no Phase 9 API can execute financial actions.

Validation checklist:

- `npx prisma validate`;
- `npx eslint src/features/wallet-agent src/app/api/wallet-agent/alert-records src/lib/security.ts --max-warnings 0`;
- `npm run build`;
- confirm `/api/wallet-agent/alert-records/history`;
- confirm `/api/wallet-agent/alert-records/history/delete`;
- confirm `/api/wallet-agent/alert-records/history/audit`.

What remains for future phases:

- durable audit storage;
- automatic retention purge worker;
- account-owned export endpoint;
- admin observability dashboard;
- controlled backfill from memory receipts to database receipts;
- real user-facing controls for history export/deletion;
- production monitoring around database adapter failures.

## Phase 10.1 account-owned alert history export

Wallet Agent Phase 10 starts with account-owned export for alert history metadata.

Endpoint:

- `GET /api/wallet-agent/alert-records/history/export`

It requires:

- verified email identity;
- endpoint-specific rate limiting;
- account-scoped access through the current verified session.

It can:

- return a JSON export bundle for the verified email;
- include the account alert history summary;
- include recent safe audit events;
- include retention policy metadata;
- preserve storage mode information from memory or database history;
- keep the export contract typed through `WalletAgentAlertHistoryExportBundle`.

It intentionally exports only:

- alert receipt metadata;
- safe history summary metrics;
- retention settings;
- bounded audit metadata.

It does not export:

- wallet private keys;
- seed phrases;
- signed transaction payloads;
- transaction payloads;
- payroll secrets;
- private wallet data;
- hidden prompt data.

It still cannot:

- generate downloadable files in the UI;
- export durable audit rows, because audit is still memory-bound;
- backfill old memory receipts into database;
- delete account identity;
- resend, retry, schedule, sign, submit, buy, sell, or pay from exports.

## Phase 10.2 account history export control

Wallet Agent now exposes the Phase 10.1 export API through the existing review panel.

It can:

- keep local fallback export as a `.txt` file when no verified account history is available;
- call `GET /api/wallet-agent/alert-records/history/export` when account history is active;
- download the account-owned export bundle as JSON;
- show a loading state while export is being prepared;
- show a safe inline error if the account export fails;
- keep export behavior inside the existing alert history card without changing transaction flows.

It still cannot:

- export durable audit rows, because audit remains memory-bound;
- let the user choose custom export fields;
- export another account's history;
- export wallet keys, seed phrases, signed payloads, private transaction data, or payroll secrets;
- resend, retry, schedule, sign, submit, buy, sell, or pay from the export control.

## Phase 10.3 account history deletion control

Wallet Agent now exposes the verified deletion endpoint through the existing alert history card.

It can:

- show account data controls only when account history is active;
- require the exact confirmation phrase `DELETE ALERT HISTORY`;
- call `POST /api/wallet-agent/alert-records/history/delete` for the verified account;
- clear the visible account history after deletion succeeds;
- show safe loading, success, and error states;
- remind the user that deletion affects only alert metadata for the verified email.

It still cannot:

- delete local browser receipts;
- delete wallets, keys, seed phrases, signed payloads, rules, schedules, or transactions;
- delete another account's history;
- bypass verified email identity;
- run automatic retention purges;
- resend, retry, schedule, sign, submit, buy, sell, or pay from the deletion control.

## Phase 10.4 account audit trail viewer

Wallet Agent now shows recent account audit events inside the existing alert history card.

It can:

- call `GET /api/wallet-agent/alert-records/history/audit?limit=4`;
- show recent metadata-only retention/deletion audit events;
- display completed and rejected deletion attempts with safe labels;
- update the audit list immediately after a successful account history deletion;
- show an inline fallback when audit events cannot be loaded.

It still cannot:

- persist audit events durably;
- show audit events from another account;
- store or display IP addresses;
- expose wallet keys, seed phrases, signed payloads, private transaction data, or payroll secrets;
- resend, retry, schedule, sign, submit, buy, sell, or pay from audit events.

## Phase 10.5 account history health summary

Wallet Agent now shows a compact health summary for alert history inside the review panel.

It can:

- summarize whether history is local, server-memory, or durable database-backed;
- show account export capability as local TXT or account JSON;
- expose the active retention window when account history is available;
- show recent audit count;
- keep a clear metadata-only safety label close to export/deletion controls.

It still cannot:

- monitor database latency or uptime;
- show production alerting metrics;
- persist audit events durably;
- run automatic retention purges;
- sign, submit, buy, sell, pay, schedule, or resend anything from the health summary.

## Phase 10.6 manual account history refresh

Wallet Agent now has a safe manual refresh control for alert history inside the review panel.

It can:

- reload local alert receipts from the browser;
- reload account-owned alert history from the server;
- reload recent metadata-only audit events;
- show an inline updating state while history and audit requests are running;
- clear stale export/delete/audit error messages before a manual refresh.

It still cannot:

- refresh another account's history;
- bypass verified email identity;
- retry or resend failed alert emails;
- trigger notification delivery from the refresh button;
- sign, submit, buy, sell, pay, schedule, or resend anything from history refresh.

## Phase 10.7 account history freshness indicator

Wallet Agent now shows when alert history was last refreshed inside the review panel.

It can:

- show an `Atualizando agora` state during manual or automatic refresh;
- show the last successful UI refresh timestamp after history and audit requests settle;
- show a first-sync waiting state before any history request completes;
- keep the freshness indicator close to the account/local sync details.

It still cannot:

- prove server uptime or database latency;
- guarantee that external email providers delivered messages after the stored receipt;
- refresh another account's history;
- trigger notifications, transactions, signatures, buys, sells, payments, or schedules.

## Phase 10.8 account history retention visibility

Wallet Agent now shows the account alert history retention policy inside the review panel.

It can:

- display the active retention window in days;
- show the maximum stored alert receipt count per verified account;
- show whether manual deletion is available for the verified email;
- estimate the expiry point from the latest stored event;
- keep the retention explanation near export, deletion, audit, and health controls.

It still cannot:

- run automatic retention purges;
- prove that old records were physically purged by an external database;
- change retention settings from the UI;
- refresh another account's history;
- trigger notifications, transactions, signatures, buys, sells, payments, or schedules.

## Phase 10.9 account history privacy boundary

Wallet Agent now shows a compact privacy boundary for alert history inside the review panel.

It can:

- explain that alert history stores metadata only;
- state that seeds, private keys, signatures, and wallet secrets are not stored;
- state that history controls cannot execute payments or trades;
- remind users that account history is tied to a verified email identity;
- keep the privacy boundary near retention, export, deletion, audit, and health controls.

It still cannot:

- audit external email provider internals;
- inspect wallet secrets;
- sign or submit transactions;
- buy, sell, pay, schedule, retry, resend, or move funds from history controls.

## Phase 10.10 account history governance closeout

Wallet Agent now shows a compact readiness checklist for alert history governance inside the review panel.

It can:

- summarize that the user can copy, export, refresh, audit, delete, and understand alert history limits;
- make the Phase 10 governance surface easier to scan;
- keep the closeout checklist metadata-only and read-only;
- clarify that the history layer is operational evidence, not a financial execution layer.

It still cannot:

- trigger notifications from the checklist;
- change retention, storage, or account settings from the checklist;
- sign or submit transactions;
- buy, sell, pay, schedule, retry, resend, or move funds from history controls.

## Phase 11.1 production readiness checklist

Wallet Agent now has a production readiness checklist for moving from controlled sandbox features toward a real operational deployment.

Before enabling production behavior, confirm:

- `DATABASE_URL` points to a managed Postgres instance with backups enabled;
- database migrations for wallet-agent alert history have been applied and verified;
- `WALLET_AGENT_ALERT_HISTORY_STORAGE=database` is set only after the database path is ready;
- `WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled` is set only when durable writes are expected;
- alert email delivery has a real provider, verified sender domain, bounce handling, and rate limits;
- email login and notification identity use the same verified account boundary;
- Devnet flows stay clearly labeled as sandbox and never accept real funds;
- mainnet transaction execution remains disabled until proposal, review, approval, signing, submission, and rollback policies are audited;
- every value-moving action has explicit user approval and wallet-side confirmation;
- logs avoid wallet secrets, seed phrases, private keys, signed payloads, and private transaction data;
- support has a documented way to export, delete, and explain alert history metadata for a verified account;
- deployment has rollback instructions for disabling database history, email delivery, and wallet-agent execution flags.

Minimum smoke test before production:

- verify email login works for a real account;
- trigger a safe alert notification and confirm chat/email/wallet copy;
- confirm the alert receipt appears in local and account history where expected;
- export account history JSON;
- refresh account history and audit trail;
- delete account history with the required confirmation phrase;
- confirm no wallet transaction is signed or submitted during history, notification, or audit flows.

It still cannot:

- enable production execution by itself;
- guarantee external provider uptime;
- run database migrations automatically;
- send production funds;
- buy, sell, pay, schedule, sign, or submit transactions without future audited execution phases.
