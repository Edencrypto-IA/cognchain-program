pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template MemoryHashMVP() {
    signal input content_hash;
    signal input model_digest;
    signal input timestamp;
    signal input nonce_digest;

    signal output memory_hash;

    component h = Poseidon(4);
    h.inputs[0] <== content_hash;
    h.inputs[1] <== model_digest;
    h.inputs[2] <== timestamp;
    h.inputs[3] <== nonce_digest;

    memory_hash <== h.out;
}

component main {public [memory_hash]} = MemoryHashMVP();

