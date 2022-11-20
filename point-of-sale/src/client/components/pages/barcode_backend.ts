import { Buffer } from 'buffer';
import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  SystemProgram, Connection,
} from '@solana/web3.js';
import {Wallet} from "@particle-network/auth";

const barcodeProgramId = new PublicKey('CjzUfJHocMEMTycycyPMtDVuttjTtaZMjtnDqTj3MXsN');

export async function createBarcodeEntry(
  wallet: PublicKey,
  connection: Connection,
  name: string,
  icon: string,
  price: number,
  barcode: string
): Promise<[TransactionInstruction, Keypair]> {

  if (!wallet) {
    console.log('Could not create barcode: wallet not connected');
    return;
  }

  const ownerKey = new PublicKey(wallet.toString());

  const barcodeKeypair = new Keypair();
  const nameStrLen = Buffer.byteLength(name);
  const iconStrLen = Buffer.byteLength(icon);
  const barcodeStrLen = Buffer.byteLength(barcode);
  const buffer = Buffer.alloc(
    // Instruction discriminant ( u8 )
    1 +
      // Size of the string name size ( u32 )
      4 +
      nameStrLen +
      // Size of the string icon size ( u32 )
      4 +
      iconStrLen +
      // Size of price ( f64 )
      8 +
      // Size of the string barcode size ( u32 )
      4 +
      barcodeStrLen
  );
  let cursor = 0;
  cursor = buffer.writeUInt8(0, cursor);

  cursor = buffer.writeUInt32LE(nameStrLen, cursor);
  cursor += buffer.write(name, cursor);

  cursor = buffer.writeUInt32LE(iconStrLen, cursor);
  cursor += buffer.write(icon, cursor);

  cursor = buffer.writeDoubleLE(price, cursor);

  cursor = buffer.writeUInt32LE(barcodeStrLen, cursor);
  buffer.write(barcode, cursor);

  console.log("data: ", deserializeBarcodeEntry(null, buffer));

  return [new TransactionInstruction({
    programId: barcodeProgramId,
    keys: [
      {
        pubkey: ownerKey,
        isWritable: true,
        isSigner: true,
      },
      {
        pubkey: barcodeKeypair.publicKey,
        isWritable: true,
        isSigner: true,
      },
      {
        pubkey: SystemProgram.programId,
        isWritable: true,
        isSigner: false,
      },
    ],
    data: buffer,
  }), barcodeKeypair];
}

export interface BarcodeEntry {
  id: PublicKey;
  owner: PublicKey;
  product_details: {
    name: String;
    icon: String;
    price: number;
  };
  barcode: string;
}

export async function getBarcodeEntries(connection: Connection, owner: PublicKey): Promise<BarcodeEntry[]> {
  const barcodeEntries: BarcodeEntry[] = [];

  const programAccounts = await connection.getProgramAccounts(barcodeProgramId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: owner.toBase58(),
        },
      },
    ],
  });


  for (const account of programAccounts) {
    barcodeEntries.push(deserializeBarcodeEntry(account.pubkey, account.account.data));
  }

  return barcodeEntries;
}


function deserializeBarcodeEntry(accountId: PublicKey, data: Buffer): BarcodeEntry {
  let cursor = 0;
  const nextBytes = (num: number) => {
    cursor += num;
    return num;
  };
  const ownerBytes = data.subarray(cursor, nextBytes(32));
  const owner = new PublicKey(ownerBytes);

  const nameStrLen = data.readUInt32LE(cursor);
  nextBytes(4);
  const nameBytes = data.subarray(cursor, cursor + nameStrLen);
  const name = nameBytes.toString();
  nextBytes(nameStrLen);

  const iconStrLen = data.readUInt32LE(cursor);
  nextBytes(4);
  const iconBytes = data.subarray(cursor, cursor + iconStrLen);
  const icon = iconBytes.toString();
  nextBytes(iconStrLen);

  const price = data.readDoubleLE(cursor);
  nextBytes(8);

  const barcodeStrLen = data.readUInt32LE(cursor);
  nextBytes(4);
  const barcodeBytes = data.subarray(cursor, cursor + barcodeStrLen);
  const barcode = barcodeBytes.toString();
  nextBytes(barcodeStrLen);

  return {
    id: accountId,
    owner,
    product_details: {
      name,
      icon,
      price
    },
    barcode
  };
}
