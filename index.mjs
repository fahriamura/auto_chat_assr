import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import axios from 'axios';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getAddressFromPrivateKey(privateKey) {
  const privateKeyBytes = bs58.decode(privateKey);
  const publicKeyBytes = nacl.sign.keyPair.fromSecretKey(privateKeyBytes).publicKey;
  return bs58.encode(publicKeyBytes);
}

async function getAuthMessage() {
  try {
    const response = await fetch('https://api.assisterr.ai/incentive/auth/login/get_message/', {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'origin': 'https://build.assisterr.ai',
        'referer': 'https://build.assisterr.ai/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Get message response:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const data = JSON.parse(responseText);
    return data.data || data.message || data;
  } catch (error) {
    console.error('Error getting message:', error);
    throw error;
  }
}

async function signMessage(message, privateKey) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const privateKeyBytes = bs58.decode(privateKey);
    const signatureBytes = nacl.sign.detached(messageBytes, privateKeyBytes);
    return bs58.encode(signatureBytes);
  } catch (error) {
    console.error('Error signing message:', error);
    throw error;
  }
}

async function login(privateKey) {
  const address = getAddressFromPrivateKey(privateKey);
  const message = await getAuthMessage();
  const signature = await signMessage(message, privateKey);

  const payload = {
    message,
    signature,
    key: address,
  };

  const response = await fetch('https://api.assisterr.ai/incentive/auth/login/', {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'origin': 'https://build.assisterr.ai',
      'referer': 'https://build.assisterr.ai/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return {
    accessToken: data.access_token,
    username: data.user.username,
  };  
}

function generateRandomText() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const length = Math.floor(Math.random() * 10) + 5;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function createSession(accessToken) {
  const response = await axios.post(
    'https://api.assisterr.ai/incentive/slm/emu_otori/chat/create_session/',
    { query: 'halo' },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        origin: 'https://build.assisterr.ai',
      },
    }
  );
  return response.data;
}

async function hitRandomQueries(sessionId, accessToken, username) {
  const endpoint = `https://api.assisterr.ai/incentive/slm/emu_otori/chat/${sessionId}/`;
  for (let i = 0; i < 10; i++) {
    const randomQuery = generateRandomText();
    try {
      const response = await axios.post(
        endpoint,
        { query: randomQuery },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            origin: 'https://build.assisterr.ai',
          },
        }
      );
      console.log(`Username: ${username}`);
      console.log(`Response for query ${i} "${randomQuery}":`, response.data);
    } catch (error) {
      console.error(`Error with query "${randomQuery}":`, error.response?.data || error.message);
    }
  }
}

(async () => {
  try {
    const privateKeys = (await fs.readFile('pk.txt', 'utf8')).split('\n').map(pk => pk.trim()).filter(pk => pk);

    for (const privateKey of privateKeys) {
      console.log(`Processing private key: ${privateKey}`);
      try {
        const { accessToken, username } = await login(privateKey);
        const sessionId = await createSession(accessToken);
        await hitRandomQueries(sessionId, accessToken, username);
      } catch (error) {
        console.error(`Error processing private key ${privateKey}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
