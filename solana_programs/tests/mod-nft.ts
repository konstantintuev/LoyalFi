import * as anchor from '@project-serum/anchor'
import { Program, Wallet } from '@project-serum/anchor'
import { MetaplexAnchorNft } from '../target/types/metaplex_anchor_nft'
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE } from '@solana/spl-token'
import {Transaction} from "@solana/web3.js";
import {updateMetadataInstruction} from "./metaplex/metadata";
import {Creator, Data} from "./metaplex/classes"; // IGNORE THESE ERRORS IF ANY
const { SystemProgram } = anchor.web3
import {createUpdateMetadataAccountV2Instruction,DataV2,UpdateMetadataAccountV2InstructionArgs,UpdateMetadataAccountV2InstructionAccounts} from "@metaplex-foundation/mpl-token-metadata"


describe('metaplex-anchor-nft-mod', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.MetaplexAnchorNft as Program<MetaplexAnchorNft>

  it("Is initialized!", async () => {
    // Add your test here.

      // This is the Update Authority Secret Key
      console.log("Connected Wallet", wallet.publicKey.toString());

      const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      );

      // You have to enter your NFT Mint address Over Here
      const mintKey = new anchor.web3.PublicKey("8rGjir8VhaJco1Ui3qaVm5nXYUnWWfMHekLdCAt6UiK6");

      const [metadatakey] = await anchor.web3.PublicKey.findProgramAddress(
          [
              Buffer.from("metadata"),
              TOKEN_METADATA_PROGRAM_ID.toBuffer(),
              mintKey.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID
      );

      console.log("Metadata address: ", metadatakey.toBase58());

      // BTW DeGods is my FAV collection although i cant afford one 🥲
      const updated_data: DataV2 = {
          name: "DeGods",
          symbol: "DG",
          uri: "https://metadata.degods.com/g/4924.json",
          sellerFeeBasisPoints: 1000,
          creators: [
              {
                  address: new anchor.web3.PublicKey(
                      "CsEYyFxVtXxezfLTUWYwpj4ia5oCAsBKznJBWiNKLyxK"
                  ),
                  verified: false,
                  share: 0,
              },
              {
                  address: wallet.publicKey,
                  verified: false,
                  share: 100,
              },
          ],
          collection: null,
          uses: null,
      };

      const accounts:UpdateMetadataAccountV2InstructionAccounts = {
          metadata: metadatakey,
          updateAuthority: wallet.publicKey,
      }

      const args:UpdateMetadataAccountV2InstructionArgs = {
          updateMetadataAccountArgsV2: {
              data: updated_data,
              updateAuthority: wallet.publicKey,
              primarySaleHappened: true,
              isMutable: true,
          }
      }

      const updateMetadataAccount = createUpdateMetadataAccountV2Instruction(
          accounts,
          args
      );

      const transaction = new anchor.web3.Transaction()
      transaction.add(updateMetadataAccount);
      const {blockhash} = await anchor.getProvider().connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      const signedTx = await wallet.signTransaction(transaction);
      const txid = await anchor.getProvider().connection.sendRawTransaction(signedTx.serialize());

      console.log("Transaction ID --",txid);
  });
});
