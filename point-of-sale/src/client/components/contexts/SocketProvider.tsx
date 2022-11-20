import {
    createTransfer,
    encodeURL,
    fetchTransaction,
    findReference,
    FindReferenceError,
    parseURL,
    validateTransfer,
    ValidateTransferError,
} from '@solana/pay';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ConfirmedSignatureInfo, Keypair, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import React, { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { useNavigateWithQuery } from '../../hooks/useNavigateWithQuery';
import { PaymentContext, PaymentStatus } from '../../hooks/usePayment';
import { SocketContext } from '../../hooks/useSocket';
import { Confirmations } from '../../types';
import useLocalStorage from './LocalStorageState';

export interface SocketProviderProps {
    children: ReactNode;
}

const poll = async function (fn, fnCondition, ms) {
    let result = await fn();
    while (fnCondition(result)) {
        await wait(ms);
        result = await fn();
    }
    return result;
};

const wait = function (ms = 1000) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

export const SocketProvider: FC<SocketProviderProps> = ({ children }) => {
    const { baseURL } = useConfig();
    const [lastEvent, setLastEvent] = useState("");
    const [lastValue, setLastValue] = useState("");

    const [merchantAddress, setMerchantAddress] = useLocalStorage("merchant-address", "");
    useEffect(() => {
        socketInitializer();
    }, [])

    const socketInitializer = async () => {
        let fetchReport = () => fetch('/api?newest=event').then((result: Response) => {
            return result.json();
        });
        let validate = (json: any) => {
            try {
                let event = json.event;
                let value = json.value;
                if (event !== lastEvent && value !== lastValue) {
                    console.log("json: ", json);
                    setLastEvent(event);
                    setLastValue(value);
                    if (event == 'merchant-address') {
                        setMerchantAddress(value);
                        console.log("merchant: ",value);
                        window.location.reload();
                    }
                }
            } catch (e) {
                console.log(e);
            }
            return true;
        };
        await poll(fetchReport, validate, 1000);
    }
    return (
        <SocketContext.Provider
            value={{}}
        >
            {children}
        </SocketContext.Provider>
    );
};
