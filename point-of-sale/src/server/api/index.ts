import {createTransfer} from '@solana/pay';
import {
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
    TransactionInstruction
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import {NextApiHandler, NextApiRequest} from 'next';
import {connection} from '../core';
import {cors, rateLimit} from '../middleware';
import {
    createTransferCheckedInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMint,
    getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";
import base58 from "bs58";
import {Account} from "@solana/spl-token/src/state/account";
import {NextApiResponse} from "next/dist/shared/lib/utils";

let socketEvent = "";
let socketValue = "";

const get: NextApiHandler = async (request, response) => {
    if (request.query.newest === "event") {
        response.status(200).send({
            event: socketEvent,
            value: socketValue,
        });
        return;
    }
    console.log("get request: ", request.body);
    const dataField = request.query.data;
    if (!dataField) throw new Error('missing dataField');
    if (typeof dataField !== 'string') throw new Error('invalid dataField');
    let dataLocal = JSON.parse(dataField);
    const label = dataLocal.label;

    const icon = `http://${request.headers.host}/solana-pay-logo.svg`;

    response.status(200).send({
        label: label,
        icon: icon,
    });
    console.log("get response: ", {
        label,
        icon,
    });
};

interface PostResponse {
    transaction: string;
    message?: string;
}

const splToken = new PublicKey(process.env.USDC_MINT as string);
const MERCHANT_WALLET = new PublicKey(process.env.MERCHANT_WALLET as string);

async function createSplTransferIx(account, connection) {
    const senderDemo = new PublicKey("AjuKnChqVZqCK8cCt2AVDHryPjgGLRHPgkGNsaymxU2d");
    //onStart(senderDemo);
    const sender = new PublicKey(account);
    console.log("sender: ", sender.toString());
    //console.log("connection: ", await connection.getClusterNodes());
    const senderInfo = await connection.getAccountInfo(sender);
    if (!senderInfo) throw new Error('sender not found');
    console.log("senderInfo: ",senderInfo.owner.toString());

    // Get the sender's ATA and check that the account exists and can send tokens
    const senderATA = await getAssociatedTokenAddress(splToken, sender);
    console.log("splToken: ", splToken, " sender: ", sender.toString(), " senderATA: ", senderATA.toString());
    const senderAccount = await getAccount(connection, senderATA);
    if (!senderAccount.isInitialized) throw new Error('sender not initialized');
    if (senderAccount.isFrozen) throw new Error('sender frozen');
    console.log("senderAccount: ", senderAccount);

    // Get the merchant's ATA and check that the account exists and can receive tokens
    // We get the shop private key from .env - this is the same as in our script
    const shopPrivateKey = process.env.MERCHANT_PRIV_KEY as string
    if (!shopPrivateKey) {
        throw new Error('Merchant private key not available');
    }
    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey))

    const merchantATA = await getAssociatedTokenAddress(splToken, MERCHANT_WALLET);
    // Merchant might not have a token account to receive payment
    const merchantAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        shopKeypair, // shop pays the fee to create it
        splToken, // which token the account is for
        MERCHANT_WALLET, // who the token account belongs to (the buyer)
    )
    if (!merchantAccount.isInitialized) throw new Error('merchant not initialized');
    if (merchantAccount.isFrozen) throw new Error('merchant frozen');
    console.log("merchantAccount: ",merchantAccount);

    // Check that the token provided is an initialized mint
    const mint = await getMint(connection, splToken);
    if (!mint.isInitialized) throw new Error('mint not initialized');
    console.log("mint: ",mint);

    // You should always calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    let amount = new BigNumber(0.2);
    amount = amount.times(new BigNumber(10).pow(mint.decimals)).integerValue(BigNumber.ROUND_FLOOR);

    // Check that the sender has enough tokens
    const tokens = BigInt(String(amount));
    if (tokens > senderAccount.amount) throw new Error('insufficient funds');

    // Create an instruction to transfer SPL tokens, asserting the mint and decimals match
    const splTransferIx = createTransferCheckedInstruction(
        senderATA,
        splToken,
        merchantATA,
        sender,
        tokens,
        mint.decimals
    );

    console.log("splTransferIx: ",splTransferIx);

    // Create a reference that is unique to each checkout session
    const references = [new Keypair().publicKey];

    // add references to the instruction
    for (const pubkey of references) {
        splTransferIx.keys.push({ pubkey, isWritable: false, isSigner: false });
    }

    return splTransferIx;
}

const sendToSock = async (host:string, event: string, data: string) => {
    console.log("sendToSock: ", socketEvent, " ", socketValue);
    socketEvent = event;
    socketValue = data;
}

const createMerchantRecipientAccount = async (accountField: string, request: NextApiRequest, response: NextApiResponse) => {
    const sender = new PublicKey(accountField);
    // Merchant might not have a token account to receive payment
    const associatedToken = await getAssociatedTokenAddress(
        splToken, sender
    );

    // This is the optimal logic, considering TX fee, client-side computation, RPC roundtrips and guaranteed idempotent.
    // Sadly we can't do this atomically.
    let account: Account;
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    try {
        account = await getAccount(connection, associatedToken);
        console.log("emit merchant-address ok");
        try {
            sendToSock(request.headers.host ?? "",'merchant-address', accountField);
        } catch (e) {
            console.log(e);
        }
        response.status(500).send({});
    } catch (error: unknown) {
        console.log(error);
        const keys = [
            { pubkey: sender, isSigner: true, isWritable: true },
            { pubkey: associatedToken, isSigner: false, isWritable: true },
            { pubkey: sender, isSigner: false, isWritable: false },
            { pubkey: splToken, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];

        // As this isn't atomic, it's possible others can create associated accounts meanwhile.
        try {
            const transaction = new Transaction().add(
                new TransactionInstruction({
                    keys,
                    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                    data: Buffer.alloc(0),
                })
            );

            //await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
            // create the transaction

            // add the instruction to the transaction
            transaction.feePayer = sender;
            const blockhash = (await connection.getLatestBlockhash('finalized')).blockhash as string;
            console.log("bloch: ",blockhash);
            transaction.recentBlockhash = blockhash;
            console.log("transaction: ",transaction);

            // Serialize and return the unsigned transaction.
            const serializedTransaction = transaction.serialize({
                verifySignatures: false,
                requireAllSignatures: false,
            });

            const base64Transaction = serializedTransaction.toString('base64');
            const message = 'Sign in order to receive USDC payments!';

            response.status(200).send({ transaction: base64Transaction, message });
            console.log("emit merchant-address NOT ok");
            sendToSock(request.headers.host ?? "",'merchant-address', accountField);
        } catch (error: unknown) {
            // Ignore all errors; for now there is no API-compatible way to selectively ignore the expected
            // instruction error if the associated account exists already.
        }
    }

}

const post: NextApiHandler<PostResponse> = async (request, response) => {
    const dataField = request.query.data;
    if (!dataField) throw new Error('missing dataField');
    if (typeof dataField !== 'string') throw new Error('invalid dataField');
    let data = JSON.parse(dataField);
    // Account provided in the transaction request body by the wallet.
    const accountField = request.body?.account;
    if (!accountField) throw new Error('missing account');

    console.log("data: ",data);
    if (data["action"] === "signin") {
        createMerchantRecipientAccount(accountField, request, response);
        return;
    }

    // create spl transfer instruction
    const splTransferIx = await createSplTransferIx(accountField, connection);

    // create the transaction
    const transaction = new Transaction();

    // add the instruction to the transaction
    transaction.add(splTransferIx);
    transaction.feePayer = new PublicKey(accountField);
    const blockhash = (await connection.getLatestBlockhash('finalized')).blockhash as string;
    console.log("bloch: ",blockhash);
    transaction.recentBlockhash = blockhash;
    console.log("transaction: ",transaction);

    // Serialize and return the unsigned transaction.
    const serializedTransaction = transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });

    const base64Transaction = serializedTransaction.toString('base64');
    const message = 'Thank you for your purchase of ExiledApe #518';

    response.status(200).send({ transaction: base64Transaction, message });
}

const postOLD: NextApiHandler<PostResponse> = async (request, response) => {
    console.log("post request: ", request.body);
    /*
    Transfer request params provided in the URL by the app client. In practice, these should be generated on the server,
    persisted along with an unpredictable opaque ID representing the payment, and the ID be passed to the app client,
    which will include the ID in the transaction request URL. This prevents tampering with the transaction request.
    */
    const recipientField = request.query.recipient;
    if (!recipientField) throw new Error('missing recipient');
    if (typeof recipientField !== 'string') throw new Error('invalid recipient');
    const recipient = new PublicKey(recipientField);

    const amountField = request.query.amount;
    if (!amountField) throw new Error('missing amount');
    if (typeof amountField !== 'string') throw new Error('invalid amount');
    const amount = new BigNumber(amountField);

    const splTokenField = request.query['spl-token'];
    if (splTokenField && typeof splTokenField !== 'string') throw new Error('invalid spl-token');
    const splToken = splTokenField ? new PublicKey(splTokenField) : undefined;

    const referenceField = request.query.reference;
    if (!referenceField) throw new Error('missing reference');
    if (typeof referenceField !== 'string') throw new Error('invalid reference');
    const reference = new PublicKey(referenceField);

    const memoParam = request.query.memo;
    if (memoParam && typeof memoParam !== 'string') throw new Error('invalid memo');
    const memo = memoParam || undefined;

    const messageParam = request.query.message;
    if (messageParam && typeof messageParam !== 'string') throw new Error('invalid message');
    const message = messageParam || undefined;

    // Account provided in the transaction request body by the wallet.
    const accountField = request.body?.account;
    if (!accountField) throw new Error('missing account');
    if (typeof accountField !== 'string') throw new Error('invalid account');
    const account = new PublicKey(accountField);

    // Compose a simple transfer transaction to return. In practice, this can be any transaction, and may be signed.
    let transaction = await createTransfer(connection, account, {
        recipient,
        amount,
        splToken,
        reference,
        memo,
    });

    console.log("post response: ", transaction);

    // Serialize and deserialize the transaction. This ensures consistent ordering of the account keys for signing.
    transaction = Transaction.from(
        transaction.serialize({
            verifySignatures: false,
            requireAllSignatures: false,
        })
    );

    // Serialize and return the unsigned transaction.
    const serialized = transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64 = serialized.toString('base64');

    response.status(200).send({ transaction: base64, message });

};

const index: NextApiHandler = async (request, response) => {
    await cors(request, response);
    await rateLimit(request, response);

    if (request.method === 'GET') return get(request, response);
    if (request.method === 'POST') return post(request, response);

    throw new Error(`Unexpected method ${request.method}`);
};

export default index;
