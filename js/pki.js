let keyPair = null; // Will store { publicKey, privateKey }

function waitForOpenPGP() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        function check() {
            attempts++;
            if (typeof openpgp !== 'undefined') {
                resolve();
            } else if (attempts >= maxAttempts) {
                console.error('OpenPGP failed to load after 5 seconds using the current CDN.');
                reject(new Error('OpenPGP library failed to load. Check CDN link and network.'));
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

// Toggle visibility of the custom public key input for Encrypt Message section
function toggleEncryptCustomPublicKey() {
    const container = document.getElementById('encryptCustomPublicKeyContainer');
    const button = document.getElementById('toggleEncryptPublicKeyBtn');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        button.textContent = 'Use Generated Public Key';
    } else {
        container.style.display = 'none';
        button.textContent = 'Use Custom Public Key';
    }
}

function copyToClipboard(text, buttonElement) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✅ Copied!';
            setTimeout(() => {
                buttonElement.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            fallbackCopyTextToClipboard(text, buttonElement);
        });
    } else {
        fallbackCopyTextToClipboard(text, buttonElement);
    }
}

function saveKeyPair() {
    if (!keyPair) {
        alert('No key pair to save. Generate keys first.');
        return;
    }

    const keyData = {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };

    const dataStr = JSON.stringify(keyData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'pgp-keypair.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function loadKeyPair() {
    document.getElementById('keyFileInput').click();
}

function handleKeyFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const keyData = JSON.parse(e.target.result);
            
            // Validate the loaded data
            if (!keyData.publicKey || !keyData.privateKey) {
                throw new Error('Invalid key file format. Missing public or private key.');
            }

            // Set the loaded keys
            keyPair = {
                publicKey: keyData.publicKey,
                privateKey: keyData.privateKey
            };

            // Clear the passphrase field since loaded keys may have a different passphrase
            document.getElementById('passphrase').value = '';
            document.getElementById('passphrase').placeholder = 'Enter passphrase for loaded keys';

            // Update UI to show keys are loaded
            const keyOutput = document.getElementById('keyOutput');
            const keyStatus = document.getElementById('keyStatus');
            
            keyOutput.style.display = 'block';
            keyOutput.className = 'output success';
            keyOutput.innerHTML = `✅ Key pair loaded successfully!<br><br>
                                    <strong>Loaded from:</strong> ${file.name}<br>
                                    <strong>Timestamp:</strong> ${keyData.timestamp || 'Unknown'}<br>
                                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 4px;">
                                        <strong>⚠️ Important:</strong> Please enter the correct passphrase for these loaded keys in the passphrase field above before signing or decrypting messages.
                                    </div>
                                    <strong>Public Key:</strong><pre>${keyPair.publicKey}</pre>
                                    <strong>Private Key:</strong><pre>${keyPair.privateKey}</pre>`;

            keyStatus.textContent = 'Ready';
            keyStatus.className = 'status ready';

            // Enable other buttons
            document.getElementById('signBtn').disabled = false;
            document.getElementById('encryptBtn').disabled = false;
            document.getElementById('decryptBtn').disabled = false;
            document.getElementById('saveKeyBtn').disabled = false;
            
            ['signStatus', 'encryptStatus', 'decryptStatus'].forEach(id => {
                const el = document.getElementById(id);
                el.textContent = 'Ready';
                el.className = 'status ready';
            });

            // Add copy buttons
            const existingCopyBtns = keyOutput.querySelectorAll('.copy-btn');
            existingCopyBtns.forEach(btn => btn.remove());

            const copyPubBtn = document.createElement('button');
            copyPubBtn.className = 'btn copy-btn';
            copyPubBtn.textContent = 'Copy Public Key';
            copyPubBtn.onclick = (event) => copyToClipboard(keyPair.publicKey, event.target);
            keyOutput.appendChild(copyPubBtn);

            const copyPrivBtn = document.createElement('button');
            copyPrivBtn.className = 'btn copy-btn';
            copyPrivBtn.style.marginLeft = '10px';
            copyPrivBtn.textContent = 'Copy Private Key';
            copyPrivBtn.onclick = (event) => copyToClipboard(keyPair.privateKey, event.target);
            keyOutput.appendChild(copyPrivBtn);

        } catch (error) {
            console.error('Key loading error:', error);
            const keyOutput = document.getElementById('keyOutput');
            keyOutput.style.display = 'block';
            keyOutput.className = 'output error';
            keyOutput.textContent = `❌ Key Loading Error: ${error.message || error}`;
        }
    };
    
    reader.readAsText(file);
    // Clear the input so the same file can be loaded again if needed
    event.target.value = '';
}

function fallbackCopyTextToClipboard(text, buttonElement) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✅ Copied!';
            setTimeout(() => {
                buttonElement.textContent = originalText;
            }, 2000);
        }
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
    }
    document.body.removeChild(textArea);
}

async function generateKeyPair() {
    const generateBtn = document.getElementById('generateBtn');
    const keyOutput = document.getElementById('keyOutput');
    const keyStatus = document.getElementById('keyStatus');

    try {
        await waitForOpenPGP();
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading"></span> Generating...';
        keyStatus.textContent = 'Generating...';
        keyStatus.className = 'status pending';

        const name = document.getElementById('userName').value;
        const email = document.getElementById('userEmail').value;
        const localPassphrase = document.getElementById('passphrase').value;

        if (!name || !email || !localPassphrase) {
            throw new Error('Please fill in all fields for key generation');
        }

        const generatedKeyPair = await openpgp.generateKey({
            userIDs: [{ name, email }],
            passphrase: localPassphrase,
            curve: 'ed25519',
            format: 'armored'
        });
        keyPair = {
            publicKey: generatedKeyPair.publicKey,
            privateKey: generatedKeyPair.privateKey
        };

        keyOutput.style.display = 'block';
        keyOutput.className = 'output success';
        keyOutput.innerHTML = `✅ Key pair generated successfully!<br><br>
                                <strong>Public Key:</strong><pre>${keyPair.publicKey}</pre>
                                <strong>Private Key:</strong><pre>${keyPair.privateKey}</pre>`;

        keyStatus.textContent = 'Ready';
        keyStatus.className = 'status ready';

        document.getElementById('signBtn').disabled = false;
        document.getElementById('encryptBtn').disabled = false;
        document.getElementById('decryptBtn').disabled = false;
        document.getElementById('saveKeyBtn').disabled = false;
        ['signStatus', 'encryptStatus', 'decryptStatus'].forEach(id => {
            const el = document.getElementById(id);
            el.textContent = 'Ready';
            el.className = 'status ready';
        });

        const existingCopyBtns = keyOutput.querySelectorAll('.copy-btn');
        existingCopyBtns.forEach(btn => btn.remove());

        const copyPubBtn = document.createElement('button');
        copyPubBtn.className = 'btn copy-btn';
        copyPubBtn.textContent = 'Copy Public Key';
        copyPubBtn.onclick = (event) => copyToClipboard(keyPair.publicKey, event.target);
        keyOutput.appendChild(copyPubBtn);

        const copyPrivBtn = document.createElement('button');
        copyPrivBtn.className = 'btn copy-btn';
        copyPrivBtn.style.marginLeft = '10px';
        copyPrivBtn.textContent = 'Copy Private Key';
        copyPrivBtn.onclick = (event) => copyToClipboard(keyPair.privateKey, event.target);
        keyOutput.appendChild(copyPrivBtn);

    } catch (error) {
        console.error('Key generation error:', error);
        keyOutput.style.display = 'block';
        keyOutput.className = 'output error';
        keyOutput.textContent = `❌ Key Generation Error: ${error.message || error}`;
        keyStatus.textContent = 'Error';
        keyStatus.className = 'status error';
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Key Pair';
    }
}

async function signMessage() {
    const signBtn = document.getElementById('signBtn');
    const signOutput = document.getElementById('signOutput');

    try {
        signBtn.disabled = true;
        signBtn.innerHTML = '<span class="loading"></span> Signing...';
        signOutput.style.display = 'none';

        const messageText = document.getElementById('messageToSign').value;
        const localPassphrase = document.getElementById('passphrase').value;

        if (!messageText) throw new Error('Please enter a message to sign');
        if (!keyPair || !keyPair.privateKey) throw new Error('Private key not available. Generate keys first.');
        if (!localPassphrase) throw new Error('Passphrase is required to sign');

        const privateKeyArmored = keyPair.privateKey;
        let privateKeyObj = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

        if (!privateKeyObj.isDecrypted()) {
            privateKeyObj = await openpgp.decryptKey({
                privateKey: privateKeyObj,
                passphrase: localPassphrase
            });
        }

        const message = await openpgp.createMessage({ text: messageText });

        const signedMessage = await openpgp.sign({
            message,
            signingKeys: privateKeyObj,
            detached: false,
            format: 'armored'
        });

        signOutput.style.display = 'block';
        signOutput.className = 'output success';
        signOutput.innerHTML = `✅ Message signed successfully!<br><br><pre>${signedMessage}</pre>`;

        const existingCopyBtn = signOutput.querySelector('.copy-btn');
        if (existingCopyBtn) existingCopyBtn.remove();

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn copy-btn';
        copyBtn.textContent = 'Copy Signed Message';
        copyBtn.onclick = (event) => copyToClipboard(signedMessage, event.target);
        signOutput.appendChild(copyBtn);

    } catch (error) {
        console.error('Signing error:', error);
        signOutput.style.display = 'block';
        signOutput.className = 'output error';
        
        let errorMessage = `❌ Signing Error: ${error.message || error}`;
        if (error.message && error.message.includes('Incorrect key passphrase')) {
            errorMessage += `\n\n💡 Troubleshooting:\n- If you loaded keys from a file, make sure you entered the correct passphrase for those keys\n- The passphrase field was cleared when you loaded the keys\n- Try entering the passphrase that was used when the keys were originally generated`;
        }
        
        signOutput.textContent = errorMessage;
    } finally {
        signBtn.disabled = false;
        signBtn.textContent = 'Sign Message';
    }
}

// Renamed existing encryptMessage to _internalEncryptMessage
async function _internalEncryptMessage(publicKeyArmored, messageText) {
    try {
        const publicKeyObj = await openpgp.readKey({ armoredKey: publicKeyArmored });
        const message = await openpgp.createMessage({ text: messageText });

        const encryptedMessage = await openpgp.encrypt({
            message,
            encryptionKeys: publicKeyObj,
            format: 'armored'
        });
        return encryptedMessage;
    } catch (error) {
        throw error;
    }
}

// New encryptMessage function to handle public key choice
async function encryptMessage() {
    const encryptBtn = document.getElementById('encryptBtn');
    const encryptOutput = document.getElementById('encryptOutput');
    const messageText = document.getElementById('messageToEncrypt').value;
    let customPublicKey = document.getElementById('encryptCustomPublicKey').value; // Get the raw value
    const useCustomKey = document.getElementById('encryptCustomPublicKeyContainer').style.display === 'block';

    try {
        encryptBtn.disabled = true;
        encryptBtn.innerHTML = '<span class="loading"></span> Encrypting...';
        encryptOutput.style.display = 'none';

        if (!messageText) throw new Error('Please enter a message to encrypt');

        let publicKeyToUse = '';

        if (useCustomKey) {
            // Sanitize the custom public key input
            customPublicKey = customPublicKey
                .trim() // Remove leading/trailing whitespace
                .replace(/\r\n/g, '\n') // Normalize Windows newlines to Unix newlines
                .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters (ZWSP, ZWNJ, ZWJ, BOM/ZWNBSP)

            if (!customPublicKey) throw new Error('Please enter a custom public key or switch to use the generated key.');
            publicKeyToUse = customPublicKey; // Use the sanitized key
        } else {
            if (!keyPair || !keyPair.publicKey) throw new Error('Generated public key not available. Generate keys first or provide a custom key.');
            publicKeyToUse = keyPair.publicKey;
        }

        const encryptedMessage = await _internalEncryptMessage(publicKeyToUse, messageText);

        encryptOutput.style.display = 'block';
        encryptOutput.className = 'output success';
        encryptOutput.innerHTML = `✅ Message encrypted successfully!<br><br><pre>${encryptedMessage}</pre>`;

        const existingCopyBtn = encryptOutput.querySelector('.copy-btn');
        if (existingCopyBtn) existingCopyBtn.remove();

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn copy-btn';
        copyBtn.textContent = 'Copy Encrypted Message';
        copyBtn.onclick = (event) => copyToClipboard(encryptedMessage, event.target);
        encryptOutput.appendChild(copyBtn);

    } catch (error) {
        console.error('Encryption error:', error);
        encryptOutput.style.display = 'block';
        encryptOutput.className = 'output error';
        encryptOutput.textContent = `❌ Encryption Error: ${error.message || error}`;
    } finally {
        encryptBtn.disabled = false;
        encryptBtn.textContent = 'Encrypt Message';
    }
}

async function decryptMessage() {
    const decryptBtn = document.getElementById('decryptBtn');
    const decryptOutput = document.getElementById('decryptOutput');

    try {
        decryptBtn.disabled = true;
        decryptBtn.innerHTML = '<span class="loading"></span> Decrypting...';
        decryptOutput.style.display = 'none';

        const encryptedText = document.getElementById('messageToDecrypt').value.trim();
        const localPassphrase = document.getElementById('passphrase').value;

        if (!encryptedText) throw new Error('Please enter an encrypted message to decrypt');
        if (!keyPair || !keyPair.privateKey) throw new Error('Private key not available. Generate keys first.');
        if (!localPassphrase) throw new Error('Passphrase is required to decrypt');

        const privateKeyArmored = keyPair.privateKey;
        let privateKeyObj = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

        if (!privateKeyObj.isDecrypted()) {
            privateKeyObj = await openpgp.decryptKey({
                privateKey: privateKeyObj,
                passphrase: localPassphrase
            });
        }

        const encryptedMessageObj = await openpgp.readMessage({ armoredMessage: encryptedText });

        const { data: decryptedMessage } = await openpgp.decrypt({
            message: encryptedMessageObj,
            decryptionKeys: privateKeyObj,
            format: 'utf8'
        });

        let outputText = `✅ Message decrypted successfully!<br><br><strong>Decrypted Message:</strong><pre>${decryptedMessage}</pre>`;

        decryptOutput.style.display = 'block';
        decryptOutput.className = 'output success';
        decryptOutput.innerHTML = outputText;

        const existingCopyBtn = decryptOutput.querySelector('.copy-btn');
        if (existingCopyBtn) existingCopyBtn.remove();

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn copy-btn';
        copyBtn.textContent = 'Copy Decrypted Message';
        copyBtn.onclick = (event) => copyToClipboard(decryptedMessage, event.target);
        decryptOutput.appendChild(copyBtn);

    } catch (error) {
        console.error('Decryption error:', error);
        decryptOutput.style.display = 'block';
        decryptOutput.className = 'output error';
        
        let errorMessage = `❌ Decryption Error: ${error.message || error}\n\nDebugging info:\n- Make sure you're using the same key pair that encrypted the message.\n- Check that the PGP message block is complete and properly formatted.\n- Verify the passphrase is correct.`;
        
        if (error.message && error.message.includes('Incorrect key passphrase')) {
            errorMessage += `\n- If you loaded keys from a file, ensure you entered the correct passphrase for those loaded keys.\n- The passphrase field was cleared when you loaded the keys.`;
        }
        
        decryptOutput.textContent = errorMessage;
    } finally {
        decryptBtn.disabled = false;
        decryptBtn.textContent = 'Decrypt Message';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    waitForOpenPGP().then(() => {
        if (openpgp && openpgp.version) {
            console.log('OpenPGP.js v' + openpgp.version + ' loaded and ready.');
        } else {
            console.log('OpenPGP.js loaded and ready (version unknown).');
        }
        document.getElementById('generateBtn').addEventListener('click', generateKeyPair);
        document.getElementById('saveKeyBtn').addEventListener('click', saveKeyPair);
        document.getElementById('loadKeyBtn').addEventListener('click', loadKeyPair);
        document.getElementById('keyFileInput').addEventListener('change', handleKeyFileLoad);
        document.getElementById('signBtn').addEventListener('click', signMessage);
        document.getElementById('encryptBtn').addEventListener('click', encryptMessage); // This now calls the new function
        document.getElementById('toggleEncryptPublicKeyBtn').addEventListener('click', toggleEncryptCustomPublicKey); // Event listener for the new button
        document.getElementById('decryptBtn').addEventListener('click', decryptMessage);
    }).catch(error => {
        console.error("Failed to initialize OpenPGP:", error);
        alert("Error: Could not load OpenPGP library. Please check the console for details and ensure the CDN link is working.");
    });
});
