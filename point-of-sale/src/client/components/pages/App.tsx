import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { GlowWalletAdapter, PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PublicKey } from '@solana/web3.js';
import { AppContext, AppProps as NextAppProps, default as NextApp } from 'next/app';
import { AppInitialProps } from 'next/dist/shared/lib/utils';
import { FC, useMemo } from 'react';
import { DEVNET_ENDPOINT } from '../../utils/constants';
import { ConfigProvider } from '../contexts/ConfigProvider';
import { FullscreenProvider } from '../contexts/FullscreenProvider';
import { PaymentProvider } from '../contexts/PaymentProvider';
import { ThemeProvider } from '../contexts/ThemeProvider';
import { TransactionsProvider } from '../contexts/TransactionsProvider';
import { SolanaPayLogo } from '../images/SolanaPayLogo';
import { SOLIcon } from '../images/SOLIcon';
import css from './App.module.css';
import useLocalStorage from "../contexts/LocalStorageState";
import PendingPage from "./PendingPage";
import {SocketProvider} from "../contexts/SocketProvider";
import NoSSR from '../contexts/NoSSR';
import NewPage from "./NewPage";

interface AppProps extends NextAppProps {
    host: string;
    query: {
        recipient?: string;
        label?: string;
        message?: string;
    };
}

const App: FC<AppProps> & { getInitialProps(appContext: AppContext): Promise<AppInitialProps> } = ({
    Component,
    host,
    query,
    pageProps,
}) => {
    const baseURL = `http://${host}`;


    // If you're testing without a mobile wallet, set this to Devnet or Mainnet to configure some browser wallets.
    const network = WalletAdapterNetwork.Devnet;

    // Toggle comments on these lines to use transaction requests instead of transfer requests.
    //const link = undefined;
    const link = useMemo(() => new URL(`${baseURL}/api/`), [baseURL]);

    let recipient: PublicKey | undefined = undefined;
    let { recipient: recipientParam, label, message } = query;
    if (recipientParam && label) {
        try {
            recipient = new PublicKey(recipientParam);
        } catch (error) {
            console.error(error);
        }
    }
    if (label == null) {
        label = "Test";
    }

    const [merchantAddress, setMerchantAddress] = useLocalStorage("merchant-address", "");


    return (
        <NoSSR>
        <ThemeProvider>
            <FullscreenProvider>
                <ConfigProvider
                    baseURL={baseURL}
                >
                <SocketProvider>
                {merchantAddress === "" ? (
                    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>

                            <PaymentProvider data={{
                                "action": "signin",
                                "message": "Merchant, please sign in with your device!",
                                "label": "Konstantin Mart"
                            }}>
                                <PendingPage/>
                            </PaymentProvider>
                    </ConnectionProvider>
                ) : (
                    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>
                            <NewPage/>
                    </ConnectionProvider>

                )}
                </SocketProvider>
                </ConfigProvider>
            </FullscreenProvider>
        </ThemeProvider>
        </NoSSR>
    );
};

App.getInitialProps = async (appContext) => {
    const props = await NextApp.getInitialProps(appContext);

    const { query, req } = appContext.ctx;
    const recipient = query.recipient as string;
    const label = query.label as string;
    const message = query.message || undefined;
    const host = req?.headers.host || 'localhost:3001';

    return {
        ...props,
        query: { recipient, label, message },
        host,
    };
};

export default App;
