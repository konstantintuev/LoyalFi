import * as anchor from '@project-serum/anchor'
import { Program, Wallet } from '@project-serum/anchor'
import {createBarcodeEntry, getBarcodeEntries} from "./backend";
import {Transaction} from "@solana/web3.js"; // IGNORE THESE ERRORS IF ANY
const { SystemProgram } = anchor.web3

describe('solana_program_barcode', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as Wallet;
  anchor.setProvider(provider);

  it("create_entry", async () => {
    // Add your test here.

      let transactionInstruction = await createBarcodeEntry(wallet,
          provider.connection,
          "Cola",
          "ok",
          2,
          "5000112552157");
      console.log("transactionInstruction: ",transactionInstruction[0]);
      console.log("data: ", transactionInstruction[0].data.toString());
      console.log("wallet: ", wallet.publicKey.toString());
    const barcodeCreateTransaction = new Transaction({
      feePayer: wallet.publicKey,
      recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    });
    // Create transaction
    barcodeCreateTransaction.add(
        transactionInstruction[0]
    );
    barcodeCreateTransaction.sign(wallet.payer, transactionInstruction[1]);
    const txid = await anchor.getProvider().connection.sendRawTransaction(barcodeCreateTransaction.serialize());
    console.log('Completed transaction', txid);
  });

  it("get_entries", async () => {
    // Add your test here.

    let barcodeEntries = await getBarcodeEntries(anchor.getProvider().connection, wallet.publicKey);
    console.log("barcodeEntries: ",barcodeEntries);
  });
});
