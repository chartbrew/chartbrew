const crypto = require("crypto");

const fallbackCipherInfo = {
  aes128: { keyLength: 16, ivLength: 16 },
  aes192: { keyLength: 24, ivLength: 16 },
  aes256: { keyLength: 32, ivLength: 16 },
};

function getCipherInfo(algorithm) {
  if (typeof crypto.getCipherInfo === "function") {
    const info = crypto.getCipherInfo(algorithm);
    if (info?.keyLength !== undefined && info?.ivLength !== undefined) {
      return info;
    }
  }

  const fallbackInfo = fallbackCipherInfo[algorithm];
  if (!fallbackInfo) {
    throw new Error(`Unsupported legacy cipher algorithm: ${algorithm}`);
  }

  return fallbackInfo;
}

function toSecretBuffer(secret) {
  if (Buffer.isBuffer(secret)) return secret;
  if (secret === undefined || secret === null) return Buffer.alloc(0);
  return Buffer.from(String(secret), "binary");
}

function evpBytesToKey(secret, keyLength, ivLength) {
  const secretBuffer = toSecretBuffer(secret);
  let derived = Buffer.alloc(0);
  let block = Buffer.alloc(0);

  while (derived.length < keyLength + ivLength) {
    const hash = crypto.createHash("md5");
    hash.update(block);
    hash.update(secretBuffer);
    block = hash.digest();
    derived = Buffer.concat([derived, block]);
  }

  return {
    key: derived.subarray(0, keyLength),
    iv: derived.subarray(keyLength, keyLength + ivLength),
  };
}

function createLegacyCipherFactory(methodName) {
  return (algorithm, secret, options) => {
    const { keyLength, ivLength } = getCipherInfo(algorithm);
    const { key, iv } = evpBytesToKey(secret, keyLength, ivLength);
    const vector = ivLength > 0 ? iv : null;

    return methodName === "createCipher"
      ? crypto.createCipheriv(algorithm, key, vector, options)
      : crypto.createDecipheriv(algorithm, key, vector, options);
  };
}

function ensureLegacyCryptoCompat() {
  if (typeof crypto.createCipher !== "function") {
    crypto.createCipher = createLegacyCipherFactory("createCipher");
  }

  if (typeof crypto.createDecipher !== "function") {
    crypto.createDecipher = createLegacyCipherFactory("createDecipher");
  }
}

ensureLegacyCryptoCompat();

module.exports = {
  ensureLegacyCryptoCompat,
};
