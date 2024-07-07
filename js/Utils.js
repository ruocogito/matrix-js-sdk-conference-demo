import {defaultMaxWhiteUntilCondition} from "/js/Enums.js";

export function getCurrentTimeString() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
}

export let isCameraOrWebcamName = function (text) {
        // Regular expression to match 'camera' or 'webcam' at the start of the string or after a space
        // and not after an open brace '{'
        const regex = /^(camera|webcam)|(?<!\(.*)\b( camera| webcam)\b/gi;

        // Search for the pattern in the text
        const matches = text.match(regex);

        // Return the matches
        return (matches || []).length > 0;
}

export let calculateHashSha256 = function (string) {
        const utf8 = new TextEncoder().encode(string);
        let cr = typeof crypto === "undefined" || !!(crypto) === false ? crypto2 : crypto
        return cr.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray
                    .map((bytes) => bytes.toString(16).padStart(2, '0'))
                    .join('');
                return hashHex;
        });
}

export async function sleepRandom(min, max) {
        return sleep(getRandomInt(min, max))
}

export async function sleep(ms) {
        return (new Promise(resolve => setTimeout(resolve, ms)));
}

export async function waitUntil(untilGetter, sleepDeltaMax = 60, maxWhiteUntilCondition = defaultMaxWhiteUntilCondition) {
        let startWaiting = Date.now()
        while(untilGetter() === false) {
                if(Date.now() - startWaiting <= maxWhiteUntilCondition)
                        throw new Error(`waitUntil timeout ${maxWhiteUntilCondition}`)
                await sleepRandom(10, sleepDeltaMax)
        }
        return true
}

export function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
}

export function getRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
}

export function isFirstHexHigher(hex1, hex2) {
        // Convert hex strings to integers
        const num1 = parseInt(hex1, 16);
        const num2 = parseInt(hex2, 16);

        // Compare the integers
        return num1 > num2;
}

export let streamInfo = (name, stream) => `${name} stream: id:${stream.id}, audio:${stream.getAudioTracks().length > 0}, video:${stream.getVideoTracks().length > 0}`