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
