import {useEffect, useState} from "react";

const useLocalStorage = (storageKey, fallbackState) => {
    const [value, setValue] = useState(
        typeof window === "undefined" ? fallbackState : (JSON.parse(window.localStorage.getItem(storageKey)) ?? fallbackState)
    );

    useEffect(() => {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
    }, [value, storageKey]);

    return [value, setValue];
};

export default useLocalStorage;
