import React, {useEffect, useState} from "react";
import Scanner from "../contexts/Scanner";
import ReactDOM from "react-dom";

import {NextPage} from "next";
import PendingPage from "./PendingPage";
import {PaymentProvider} from "../contexts/PaymentProvider";
import {getBarcodeEntries} from "./barcode_backend";
import {useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";

const NewPage: NextPage = () => {
    const {connection} = useConnection();
    const [barcodeEntries, setBarcodeEntries] = useState<any>([]);

    useEffect(() => {
        getBarcodeEntries(connection, new PublicKey("CjzUfJHocMEMTycycyPMtDVuttjTtaZMjtnDqTj3MXsN"))
            .then(data => {
                    console.log(data);
                    setBarcodeEntries(data);
                }
            );
    }, [])

    function NumberList(props) {
        console.log(props);
        const listItems = props.map((number) =>
            <li>{number}</li>
        );
        return (
            <ul>{listItems}</ul>
        );
    }
    return(
        <div>
            <h2>Barcodes on-chain</h2>
            <NumberList numbers={barcodeEntries} />
        </div>
    )
};

export default NewPage;
