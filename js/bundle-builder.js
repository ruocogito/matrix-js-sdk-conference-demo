//global.matrixSdkCrypto = await import("@matrix-org/matrix-sdk-crypto-wasm");
global.crypto2 = require('crypto');
global.Olm = require('@matrix-org/olm');
// const path = require('path');
//const olm = require('olm');
//global.Olm = olm;
//global.wasmData = await import('./node_modules/@matrix-org/olm/olm.wasm');

//global.wasmPath = "/js/node_modules/olm/olm.wasm" //path.resolve(__dirname, 'olm.wasm');

import * as sdk from "matrix-js-sdk";

// Enable encryption by importing and initializing libolm

const util = require('util');

global.inspect = util.inspect



