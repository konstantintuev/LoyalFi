extern crate solana_program;
extern crate borsh;

use borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use solana_program::{account_info::{next_account_info, AccountInfo}, declare_id, entrypoint, entrypoint::ProgramResult, instruction::{AccountMeta, Instruction}, msg, program::invoke, program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction, system_program, sysvar::Sysvar};

declare_id!("CjzUfJHocMEMTycycyPMtDVuttjTtaZMjtnDqTj3MXsN");

entrypoint!(process_instruction);

#[derive(BorshDeserialize, BorshSerialize)]
pub enum BarcodeInstruction {
    /// Expected accounts when calling this instruction are
    ///
    /// 0. `[writeable,signer]` Funding account and owner of the new barcode (must be a system account)
    /// 1. `[writeable]` Unallocated account for storing the barcode
    /// 2. `[]` System program
    CreateBarcodeItem {
        details: ProductDetails,
        barcode: String,
    },
}

/// Get an instruction that will create a barcode
///
/// # Arguments
/// - `program_id`: This must be the program ID of the the Barcode program
/// - `owner_account`: The owner of the new barcode, and also the person that will be funding the
///   new barcode
/// - `barcode_account`: An un-allocated account that we will create the barcode under
/// - `product_details`: The details to create the product details with
pub fn create_time_slot(
    program_id: Pubkey,
    owner_account: Pubkey,
    barcode_account: Pubkey,
    product_details: ProductDetails,
    meeting_id: String,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(owner_account, true),
            AccountMeta::new(barcode_account, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: BarcodeInstruction::CreateBarcodeItem {
            details: product_details,
            barcode: meeting_id,
        }
        .try_to_vec()
        .expect("IO error"),
    }
}

#[derive(Debug, BorshDeserialize, BorshSerialize)]
pub struct BarcodeEntry {
    pub owner: Pubkey,
    pub product_details: ProductDetails,
    pub barcode: String,
}

#[derive(Debug, BorshDeserialize, BorshSerialize, BorshSchema)]
/// The barcode range
pub struct ProductDetails {
    pub name: String,
    pub icon: String,
    pub price: f64,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let processor = Processor::new(program_id, accounts, data);

    processor.process()?;

    Ok(())
}

struct Processor<'a, 'b> {
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'b>],
    data: &'a [u8],
}

impl<'a, 'b> Processor<'a, 'b> {
    fn new(program_id: &'a Pubkey, accounts: &'a [AccountInfo<'b>], data: &'a [u8]) -> Self {
        Self {
            program_id,
            accounts,
            data,
        }
    }

    fn process(&self) -> ProgramResult {
        let transaction = BarcodeInstruction::try_from_slice(self.data)?;

        match transaction {
            BarcodeInstruction::CreateBarcodeItem { details, barcode } => {
                self.create_barcode_item(details, barcode)?
            }
        }

        Ok(())
    }

    fn create_barcode_item(&self, product_details: ProductDetails, barcode: String) -> ProgramResult {
        msg!("Creating new barcode");
        let accounts = &mut self.accounts.iter();

        // Get our accounts
        let owner_account = next_account_info(accounts)?;
        let barcode_account = next_account_info(accounts)?;
        let system_program_account = next_account_info(accounts)?;

        // Get the rent sysvar
        let rent = Rent::get()?;

        // Make sure that the owner of the account has signed this transaction
        if !owner_account.is_signer {
            msg!("The owner account must sign the transaction when creating a barcode");
            return Err(ProgramError::MissingRequiredSignature);
        }
        // Make sure that the owner is a system account ( not 100% sure this is necessary but I
        // can't think of a situation where it shouldn't be a system account )
        if owner_account.owner != &system_program::ID {
            msg!("The owner account must be a system program");
            return Err(ProgramError::InvalidAccountData);
        }

        // Create a barcode with the given owner and time
        let barcode_entry = BarcodeEntry {
            owner: *owner_account.key,
            product_details,
            barcode,
        };
        // Serialize the barcode to it's raw bytes
        let mut barcode_entry_data = barcode_entry.try_to_vec()?;
        let barcode_entry_data_len = barcode_entry_data.len();

        // Create the barcode account
        invoke(
            &system_instruction::create_account(
                owner_account.key,
                barcode_account.key,
                1.max(rent.minimum_balance(barcode_entry_data_len)),
                barcode_entry_data_len as u64,
                self.program_id,
            ),
            &[
                owner_account.clone(),
                barcode_account.clone(),
                system_program_account.clone(),
            ],
        )?;
        // Make this program the owner of the new account
        invoke(
            &system_instruction::assign(barcode_account.key, self.program_id),
            &[barcode_account.clone(), system_program_account.clone()],
        )?;

        // Write the serialized data to the barcode account
        barcode_entry_data.swap_with_slice(*barcode_account.try_borrow_mut_data()?);

        Ok(())
    }
}
