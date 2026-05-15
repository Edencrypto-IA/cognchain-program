import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  type Connection,
} from '@solana/web3.js';
import type {
  WalletAgentCoreResult,
  WalletAgentPreparedTransaction,
} from './types';

type SignTransaction = (transaction: Transaction) => Promise<Transaction>;

function isSupportedDevnetTransfer(result: WalletAgentCoreResult) {
  const { draft } = result;

  return (
    draft.network === 'solana-devnet' &&
    draft.transactionProposal?.status === 'ready_for_wallet_signature' &&
    (draft.type === 'SCHEDULE_PAYMENT' || draft.type === 'PRIVACY_PAYMENT') &&
    !!draft.walletAddress &&
    !!draft.entities.recipientAddress &&
    typeof draft.entities.amountSol === 'number' &&
    draft.entities.amountSol > 0
  );
}

export async function prepareWalletAgentDevnetTransaction(
  result: WalletAgentCoreResult,
  connection: Connection,
  now = new Date()
): Promise<WalletAgentCoreResult> {
  if (!isSupportedDevnetTransfer(result)) {
    return {
      ...result,
      draft: {
        ...result.draft,
        preparedTransaction: null,
        warnings: [
          ...result.draft.warnings,
          'Preparacao Devnet disponivel apenas para transferencia SOL com carteira, destinatario e valor completos.',
        ],
      },
      safety: {
        ...result.safety,
        status: result.safety.status === 'ready_for_wallet_signature'
          ? 'needs_user_review'
          : result.safety.status,
        reason: 'Esta intencao ainda nao tem um builder Devnet suportado.',
      },
    };
  }

  const fromPublicKey = new PublicKey(result.draft.walletAddress!);
  const toPublicKey = new PublicKey(result.draft.entities.recipientAddress!);
  const amountLamports = Math.round(result.draft.entities.amountSol! * LAMPORTS_PER_SOL);
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: fromPublicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports: amountLamports,
    })
  );
  const serializedTransactionBase64 = transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
  const preparedTransaction: WalletAgentPreparedTransaction = {
    id: `wap_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'prepared_unsigned',
    network: 'solana-devnet',
    kind: 'sol_transfer',
    fromAddress: fromPublicKey.toString(),
    toAddress: toPublicKey.toString(),
    amountSol: result.draft.entities.amountSol!,
    latestBlockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    serializedTransactionBase64,
    createdAt: now.toISOString(),
    warnings: [
      'Transacao preparada sem assinatura.',
      'Nada foi enviado para a rede.',
      'A proxima etapa deve abrir a wallet para aprovacao explicita do usuario.',
    ],
    nextStep: 'wallet_signature_required',
  };

  return {
    ...result,
    draft: {
      ...result.draft,
      approvalStep: 'unsigned_transaction_prepared',
      preparedTransaction,
    },
    safety: {
      ...result.safety,
      status: 'ready_for_wallet_signature',
      reason: 'Transacao Devnet preparada localmente. Ainda falta assinatura explicita na wallet.',
    },
    review: {
      ...result.review,
      subtitle: 'Transacao Devnet preparada localmente. Revise o payload e assine somente se estiver correto.',
    },
  };
}

function transactionFromBase64(serializedTransactionBase64: string) {
  const binary = globalThis.atob(serializedTransactionBase64);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return Transaction.from(bytes);
}

export async function signWalletAgentDevnetTransaction(
  result: WalletAgentCoreResult,
  signTransaction: SignTransaction | undefined,
  signerAddress: string | null,
  now = new Date()
): Promise<WalletAgentCoreResult> {
  const prepared = result.draft.preparedTransaction;

  if (!prepared || prepared.status !== 'prepared_unsigned') {
    return {
      ...result,
      safety: {
        ...result.safety,
        reason: 'Prepare uma transacao Devnet antes de solicitar assinatura da wallet.',
      },
    };
  }

  if (!signTransaction || !signerAddress) {
    return {
      ...result,
      safety: {
        ...result.safety,
        reason: 'Wallet externa com assinatura nao esta conectada. Use Phantom ou Solflare para assinar.',
      },
    };
  }

  if (signerAddress !== prepared.fromAddress) {
    return {
      ...result,
      safety: {
        ...result.safety,
        status: 'blocked',
        reason: 'A wallet conectada nao corresponde a carteira de origem da transacao preparada.',
      },
    };
  }

  const transaction = transactionFromBase64(prepared.serializedTransactionBase64);
  const signedTransaction = await signTransaction(transaction);
  const signedTransactionBase64 = signedTransaction
    .serialize({ requireAllSignatures: true, verifySignatures: true })
    .toString('base64');

  return {
    ...result,
    draft: {
      ...result.draft,
      approvalStep: 'wallet_signed',
      signedTransaction: {
        id: `was_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        status: 'signed_not_submitted',
        network: 'solana-devnet',
        signedTransactionBase64,
        signedAt: now.toISOString(),
        signerAddress,
        nextStep: 'submit_to_devnet',
        warnings: [
          'Transacao assinada pela wallet do usuario.',
          'A transacao ainda nao foi enviada para a rede.',
          'O envio para Devnet deve ser uma etapa separada com confirmacao visivel.',
        ],
      },
    },
    safety: {
      ...result.safety,
      status: 'ready_for_wallet_signature',
      reason: 'Transacao assinada pela wallet. Ainda nao foi enviada para a Solana Devnet.',
    },
    review: {
      ...result.review,
      subtitle: 'Transacao assinada pela wallet. O envio para Devnet ainda exige uma etapa separada.',
    },
  };
}
