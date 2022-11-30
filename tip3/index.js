const fs = require('fs');
const path = require('path');
const { TonClient, abiContract, signerKeys, signerNone } = require('@eversdk/core');
const { libNode } = require('@eversdk/lib-node');

// ABI and imageBase64 of a binary HelloWallet contract
const { HelloWallet } = require('../hello-wallet/contracts/HelloWallet.js');
const { TokenRoot } = require('./contracts/TokenRoot.js');
const GIVER_ABI = require('../hello-wallet/contracts/GiverV2.abi.json');
const GIVER_KEYS = readKeysFromFile('../hello-wallet/GiverV2.keys.json');

/**
 * If you are running this script not on the Evernode SE, you should:
 *  - change `ENDPOINTS`
 *  - change `GIVER_ADDRESS`
 *  - write down giver keys into 'GiverV2.keys.json'
 */
const ENDPOINTS = ['http://localhost'];
const GIVER_ADDRESS = '0:b5e9240fc2d2f1ff8cbb1d1dee7fb7cae155e5f6320e585fcc685698994a19a5';

// Link the platform-dependable ever-sdk binary with the target Application in Typescript
// This is a Node.js project, so we link the application with `libNode` binary
// from `@eversdk/lib-node` package
// If you want to use this code on other platforms, such as Web or React-Native,
// use  `@eversdk/lib-web` and `@eversdk/lib-react-native` packages accordingly
// (see README in  https://github.com/tonlabs/ever-sdk-js)
TonClient.useBinaryLibrary(libNode);
const client = new TonClient({
    network: {
        endpoints: ENDPOINTS
    },
});

(async () => {
    try {
        // Generate an ed25519 key pair
        const walletKeys = await client.crypto.generate_random_sign_keys();
        console.log("wallet key :", walletKeys);
        
        
        // Calculate token root address.
        const tokenRootAddress = await calcTokenRootAddress(walletKeys);

        //Send Ever to address
        await getTokensFromGiver(tokenRootAddress, 100_000_000_000);

        // Deploy Token Root
        console.log("deploying token root");
        await deployTokenRoot(walletKeys);

        
        console.log('Normal exit');
        process.exit(0);
    } catch (error) {
        if (error.code === 504) {
            console.error(
                [
                    'Network is inaccessible. You have to start Evernode SE using `everdev se start`',
                    'If you run SE on another port or ip, replace http://localhost endpoint with',
                    'http://localhost:port or http://ip:port in index.js file.',
                ].join('\n'),
            );
        } else {
            console.error(error);
            process.exit(1);
        }
    }
})();

async function calcTokenRootAddress(keys) {
    
    const { address } = await client.abi.encode_message(buildDeployTokenRootOptions(keys));
    console.log(`Token root  contract is: ${address}`);
    return address;
}


function buildDeployTokenRootOptions(keys) {
    const ownerUser =   "0:1fac4b3651a78d759956347d3383eba6377e0dc87d46b5ea68d5f103c5b9dfb7";
    const zeroAddress = "0:0000000000000000000000000000000000000000000000000000000000000000";
    const initialSupplyTo = zeroAddress;
    const rootOwner = ownerUser;  
    const tokenWalletCode = "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";
    const deployOptions = {
        abi: {
            type: 'Contract',
            value: TokenRoot.abi,
        },
        deploy_set: {
            tvc: TokenRoot.tvc,
            initial_data: {
                deployer_: zeroAddress,
                randomNonce_: 12345,
                rootOwner_: rootOwner,
                name_: "Test TIP3 Token",
                symbol_: "TTT",
                decimals_: 6,
                walletCode_: tokenWalletCode,
            },
        },
        call_set: {
            function_name: 'constructor',
            input: {
                initialSupplyTo: initialSupplyTo,
                initialSupply: 30_000_000,
                deployWalletValue: 100_000_000,
                mintDisabled: false,
                burnByRootDisabled: false,
                burnPaused: false,
                remainingGasTo: ownerUser
            },
        },
        signer: {
            type: 'Keys',
            keys,
        },
    };
    return deployOptions;
}

// Request funds from Giver contract
async function getTokensFromGiver(dest, value) {
    console.log(`Transfering ${value} tokens from giver to ${dest}`);

    const params = {
        send_events: false,
        message_encode_params: {
            address: GIVER_ADDRESS,
            abi: abiContract(GIVER_ABI),
            call_set: {
                function_name: 'sendTransaction',
                input: {
                    dest,
                    value,
                    bounce: false,
                },
            },
            signer: {
                type: 'Keys',
                keys: GIVER_KEYS,
            },
        },
    };
    await client.processing.process_message(params);
    console.log('Success. Tokens were transfered\n');
}



async function deployTokenRoot(walletKeys) {
    console.log('Deploying Token Root contract');
    await client.processing.process_message({
        send_events: false,
        message_encode_params: buildDeployTokenRootOptions(walletKeys),
    });
    console.log('Success. Contract was deployed\n');
}

async function runOnChain(address, methodName) {
    // Encode the message with external call
    const params = {
        send_events: false,
        message_encode_params: {
            address,
            abi: {
                type: 'Contract',
                value: HelloWallet.abi,
            },
            call_set: {
                function_name: methodName,
                input: {},
            },
            signer: signerNone(),
        },
    };
    console.log(`Calling ${methodName} function`);
    const response = await client.processing.process_message(params);
    const { id, lt } = response.transaction;
    console.log('Success. TransactionId is: %s\n', id);
    return lt;
}


// Sometimes it is needed to execute getmethods after on-chain calls.
// This means that the downloaded account state should have the changes made by the on-chain call. 
// To ensure it, we need to remember the transaction lt (logical time) of the last call
// and then wait for the account state to have lt > the transaction lt. 
// Note that account.last_trans_lt is always bigger than transaction.lt because this field stores the end lt of transaction interval
// For more information about transaction lt interval read TON Blockchain spec https://test.ton.org/tblkch.pdf P. 4.2.1
async function waitForAccountUpdate(address, transLt) {
    console.log('Waiting for account update');
    const startTime = Date.now();
    const account = await client.net.wait_for_collection({
        collection: 'accounts',
        filter: {
            id: { eq: address },
            last_trans_lt: { gt: transLt },
        },
        result: 'boc',
    });
    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`Success. Account was updated, it took ${duration} sec.\n`);
    return account;
}


async function getAccount(address) {

    // `boc` or bag of cells - native blockchain data layout. Account's boc contains full account state (code and data) that
    // we will  need to execute get methods.
    const query = `
        query {
          blockchain {
            account(
              address: "${address}"
            ) {
               info {
                balance(format: DEC)
                boc
              }
            }
          }
        }`
    const {result}  = await client.net.query({query})
    const info = result.data.blockchain.account.info
    return info
}
async function runGetMethod(methodName, address, accountState) {
    // Execute the get method `getTimestamp` on the latest account's state
    // This can be managed in 3 steps:
    // 1. Download the latest Account State (BOC) 
    // 2. Encode message
    // 3. Execute the message locally on the downloaded state

    // Encode the message with `getTimestamp` call
    const { message } = await client.abi.encode_message({
        // Define contract ABI in the Application
        // See more info about ABI type here:
        // https://github.com/tonlabs/ever-sdk/blob/master/docs/reference/types-and-methods/mod_abi.md#abi
        abi: {
            type: 'Contract',
            value: HelloWallet.abi,
        },
        address,
        call_set: {
            function_name: methodName,
            input: {},
        },
        signer: { type: 'None' },
    });

    // Execute `getTimestamp` get method  (execute the message locally on TVM)
    // See more info about run_tvm method here:
    // https://github.com/tonlabs/ever-sdk/blob/master/docs/reference/types-and-methods/mod_tvm.md#run_tvm
    console.log('Run `getTimestamp` get method');
    const response = await client.tvm.run_tvm({
        message,
        account: accountState,
        abi: {
            type: 'Contract',
            value: HelloWallet.abi,
        },
    });
    return response.decoded.output
}


async function runGetMethodAfterLt(methodName, address, transLt) {
    // Wait for the account state to be more or equal the spesified logical time
    const accountState = await waitForAccountUpdate(address, transLt).then(({ result }) => result.boc);
    const result = await runGetMethod(methodName, address, accountState);
    return result;
    
}

async function sendValue(address, dest, amount, keys) {
    // Encode the message with `sendValue` function call
    const sendValueParams = {
        send_events: false,
        message_encode_params: {
            address,
            // Define contract ABI in the Application
            // See more info about ABI type here:
            // https://github.com/tonlabs/ever-sdk/blob/master/docs/reference/types-and-methods/mod_abi.md#abi
            abi: {
                type: 'Contract',
                value: HelloWallet.abi,
            },
            call_set: {
                function_name: 'sendValue',
                input: {
                    dest,
                    amount,
                    bounce: false,
                },
            },
            signer: signerKeys(keys),
        },
    };
    console.log(`Sending ${amount} tokens to ${dest}`);
    // Call `sendValue` function
    const response = await client.processing.process_message(sendValueParams);
    console.log('Success. Target account will recieve: %d tokens\n', response.fees.total_output);
    return response.transaction.lt;
}

// Helpers
function readKeysFromFile(fname) {
    const fullName = path.join(__dirname, fname);
    // Read the Giver keys. We need them to sponsor a new contract
    if (!fs.existsSync(fullName)) {
        console.log(`Please place ${fname} file with Giver keys in project root folder`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(fullName, 'utf8'));
}

async function genRandomAddress() {
    const { bytes } = await client.crypto.generate_random_bytes({ length: 32 });
    return `0:${Buffer.from(bytes, 'base64').toString('hex')}`;
}
