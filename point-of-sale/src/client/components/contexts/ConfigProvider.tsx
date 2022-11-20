import { PublicKey } from '@solana/web3.js';
import React, { FC, ReactElement, ReactNode } from 'react';
import { ConfigContext } from '../../hooks/useConfig';
import { Confirmations, Digits } from '../../types';

export interface ConfigProviderProps {
    children: ReactNode;
    baseURL: string;
    requiredConfirmations?: Confirmations;
}

export const ConfigProvider: FC<ConfigProviderProps> = ({
    children,
    baseURL,
    requiredConfirmations = 1,
}) => {
    return (
        <ConfigContext.Provider
            value={{
                baseURL,
                requiredConfirmations,
            }}
        >
            {children}
        </ConfigContext.Provider>
    );
};
