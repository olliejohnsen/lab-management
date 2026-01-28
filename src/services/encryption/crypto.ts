import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get the encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // Derive a key from the environment variable
  return crypto.pbkdf2Sync(key, "lab-management-salt", 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypt data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:encrypted:tag (all hex encoded)
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // Return salt:iv:encrypted:tag
    return [
      salt.toString("hex"),
      iv.toString("hex"),
      encrypted,
      tag.toString("hex"),
    ].join(":");
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param encryptedData - Encrypted string in format: salt:iv:encrypted:tag
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(":");

    if (parts.length !== 4) {
      throw new Error("Invalid encrypted data format");
    }

    const [saltHex, ivHex, encrypted, tagHex] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Encrypt an object to a JSON string
 * @param obj - Object to encrypt
 * @returns Encrypted string
 */
export function encryptObject<T>(obj: T): string {
  const json = JSON.stringify(obj);
  return encrypt(json);
}

/**
 * Decrypt an encrypted JSON string back to an object
 * @param encryptedData - Encrypted string
 * @returns Decrypted object
 */
export function decryptObject<T>(encryptedData: string): T {
  const json = decrypt(encryptedData);
  return JSON.parse(json);
}
