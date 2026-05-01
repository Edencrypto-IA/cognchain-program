// ============================================================
// NFT Service — Mint verified memories as NFTs on Solana Devnet
// Uses Metaplex Token Metadata program
// ============================================================

const SOLANA_DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export interface MintNFTResult {
  success: boolean;
  mintAddress?: string;
  txHash?: string;
  explorerUrl?: string;
  message: string;
  simulated?: boolean;
}

/**
 * Sanitize a string for safe SVG interpolation (prevent XML injection).
 */
function sanitizeForSVG(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\{|\}/g, '')
    .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '');
}

/**
 * Mint a memory as an NFT on Solana Devnet.
 */
export async function mintMemoryAsNFT(params: {
  memoryHash: string;
  content: string;
  model: string;
  previousModel?: string;
  score?: number;
  timestamp: string;
  walletAddress?: string;
}): Promise<MintNFTResult> {
  try {
    const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
    const { createMetadataAccountV3, mplTokenMetadata } = await import('@metaplex-foundation/mpl-token-metadata');
    const { keypairIdentity, createSignerFromKeypair } = await import('@metaplex-foundation/umi');
    const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

    const umi = createUmi(SOLANA_DEVNET_RPC);
    umi.use(mplTokenMetadata());

    const mintKeypair = Keypair.generate();
    const mintPubkey = mintKeypair.publicKey;

    const payer = Keypair.generate();
    const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');

    const airdropSig = await connection.requestAirdrop(payer.publicKey, 0.5 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSig, 'confirmed');

    const nftName = `CONGCHAIN Memory #${sanitizeForSVG(params.memoryHash.substring(0, 6))}`;
    const nftSymbol = 'CGMN';
    const nftDescription = [
      `Verified AI Memory on CONGCHAIN`,
      ``,
      `Origin Model: ${sanitizeForSVG(params.model)}${params.previousModel ? ' | Evolved with: ' + sanitizeForSVG(params.previousModel) : ''}`,
      `Score: ${params.score != null ? params.score + '/10' : 'N/A'}`,
      `Hash: ${sanitizeForSVG(params.memoryHash)}`,
      `Timestamp: ${sanitizeForSVG(params.timestamp)}`,
      params.walletAddress ? `Owner: ${sanitizeForSVG(params.walletAddress)}` : '',
      ``,
      `NFT is not the product. It is just a way to prove ownership of memory.`,
      ``,
      `Content preview:`,
      sanitizeForSVG(params.content.substring(0, 200)) + (params.content.length > 200 ? '...' : ''),
    ].filter(Boolean).join('\n');

    // Generate SVG with sanitized values
    const svgImage = generateNFTImage({
      hash: params.memoryHash,
      model: params.model,
      previousModel: params.previousModel,
      score: params.score,
    });

    const uri = `data:image/svg+xml;base64,${Buffer.from(svgImage).toString('base64')}`;

    const umiPayer = umi.eddsa.createKeypairFromSecretKey(
      new Uint8Array(payer.secretKey)
    );
    const umiMint = umi.eddsa.createKeypairFromSecretKey(
      new Uint8Array(mintKeypair.secretKey)
    );

    const umiPayerSigner = createSignerFromKeypair(umi, umiPayer);
    umi.use(keypairIdentity(umiPayerSigner));

    await createMetadataAccountV3(umi, {
      mint: umiMint.publicKey,
      mintAuthority: umiPayerSigner,
      updateAuthority: umiPayerSigner.publicKey,
      data: {
        name: nftName,
        symbol: nftSymbol,
        uri: uri,
        sellerFeeBasisPoints: 500,
        creators: [
          {
            address: umiPayer.publicKey,
            verified: true,
            share: 100,
          },
        ],
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    }).sendAndConfirm(umi);

    return {
      success: true,
      mintAddress: mintPubkey.toString(),
      message: `Memory NFT minted successfully!`,
      explorerUrl: `https://explorer.solana.com/address/${mintPubkey.toString()}?cluster=devnet`,
      simulated: false,
    };
  } catch (error) {
    console.error('[NFT] Mint failed:', error);
    // SECURITY FIX: Never return fake success with random address
    return {
      success: false,
      message: 'NFT minting failed. Solana Devnet may be unavailable. Please try again later.',
      simulated: false,
    };
  }
}

/**
 * Generate a sanitized SVG image for the NFT.
 * All dynamic values are escaped before interpolation.
 */
function generateNFTImage({ hash, model, previousModel, score }: { hash: string; model: string; previousModel?: string; score?: number }) {
  const colors = model === 'gpt'
    ? ['#10b981', '#059669', '#047857']
    : model === 'claude'
    ? ['#00D1FF', '#0099cc', '#006699']
    : ['#9945FF', '#7c3aed', '#6d28d9'];

  const safeHash = sanitizeForSVG(hash.substring(0, 16));
  const safeModel = sanitizeForSVG(model.toUpperCase());
  const safePrevModel = previousModel ? sanitizeForSVG(previousModel.toUpperCase()) : '';
  const safeScore = score != null ? score : null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${colors[0]}" />
      <stop offset="50%" stop-color="${colors[1]}" />
      <stop offset="100%" stop-color="${colors[2]}" />
    </radialGradient>
    <radialGradient id="orb" cx="35%" cy="35%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="${colors[0]}" stop-opacity="0.8"/>
      <stop offset="70%" stop-color="${colors[1]}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#06060e" stop-opacity="0.9"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#06060e"/>
  <rect width="512" height="512" fill="url(#bg)" opacity="0.3"/>
  <circle cx="256" cy="200" r="80" fill="url(#orb)" />
  <circle cx="256" cy="200" r="82" fill="none" stroke="${colors[0]}" stroke-width="1" opacity="0.5"/>
  <text x="256" y="330" font-family="monospace" font-size="28" fill="white" text-anchor="middle" font-weight="bold">CONGCHAIN</text>
  <text x="256" y="358" font-family="monospace" font-size="14" fill="white" opacity="0.5" text-anchor="middle">Verifiable AI Memory Layer</text>
  <text x="256" y="400" font-family="monospace" font-size="11" fill="${colors[0]}" text-anchor="middle" opacity="0.7">${safeHash}...</text>
  ${safeScore !== null ? `<text x="256" y="425" font-family="monospace" font-size="12" fill="#14F195" text-anchor="middle">Score: ${safeScore}/10</text>` : ''}
  <text x="256" y="445" font-family="monospace" font-size="10" fill="white" opacity="0.5" text-anchor="middle">Origin: ${safeModel}${safePrevModel ? ' | Evolved: ' + safePrevModel : ''}</text>
  <rect x="206" y="462" width="100" height="24" rx="12" fill="white" opacity="0.1"/>
  <text x="256" y="478" font-family="monospace" font-size="10" fill="white" text-anchor="middle" opacity="0.6">SOLANA DEVNET</text>
</svg>`;
}
