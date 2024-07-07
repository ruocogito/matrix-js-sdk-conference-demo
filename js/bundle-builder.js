//global.matrixSdkCrypto = await import("@matrix-org/matrix-sdk-crypto-wasm");
//hex calc
global.crypto2 = require('crypto');
//for crypto support
global.Olm = require('@matrix-org/olm');

// const path = require('path');
//const olm = require('olm');
//global.Olm = olm;
//global.wasmData = await import('./node_modules/@matrix-org/olm/olm.wasm');

//global.wasmPath = "/js/node_modules/olm/olm.wasm" //path.resolve(__dirname, 'olm.wasm');

import * as sdk from "matrix-js-sdk";

//export let getMatrixSdk = () => {
//	return matrixcs;
//}

// Enable encryption by importing and initializing libolm

//Debug
const util = require('util');

global.inspect = util.inspect



