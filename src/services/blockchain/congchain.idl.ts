export const CONGCHAIN_PROGRAM_ID = 'BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL';

export const IDL = {
  version: '0.1.0',
  name: 'congchain',
  instructions: [
    {
      name: 'storeMemory',
      accounts: [
        { name: 'memoryRecord', isMut: true,  isSigner: false },
        { name: 'signer',       isMut: true,  isSigner: true  },
        { name: 'systemProgram',isMut: false, isSigner: false },
      ],
      args: [
        { name: 'hash',  type: { array: ['u8', 32] } },
        { name: 'model', type: 'string' },
      ],
    },
    {
      name: 'verifyMemory',
      accounts: [
        { name: 'memoryRecord', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'hash', type: { array: ['u8', 32] } },
      ],
    },
  ],
  accounts: [
    {
      name: 'MemoryRecord',
      type: {
        kind: 'struct',
        fields: [
          { name: 'hash',      type: { array: ['u8', 32] } },
          { name: 'model',     type: 'string'              },
          { name: 'timestamp', type: 'i64'                 },
          { name: 'owner',     type: 'publicKey'           },
        ],
      },
    },
  ],
} as const;
