import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

export function generateEnvContent(encryptionKey = generateEncryptionKey()) {
  return `# FreeLLMAPI Render Environment Configuration
# Automatically generated on ${new Date().toISOString()}

# Required: 64-character hex key (32 bytes) for AES-256-GCM encryption of provider keys
ENCRYPTION_KEY=${encryptionKey}

# Port for the web service (Render defaults to 10000 or custom 3001)
PORT=3001

# Bind to all interfaces so Render's reverse proxy can reach the container
HOST_BIND=0.0.0.0

# Environment mode
NODE_ENV=production
`;
}

// When run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('generate-env.js')) {
  const key = generateEncryptionKey();
  const envContent = generateEnvContent(key);
  
  console.log('----------------------------------------------------');
  console.log('Generated 64-character ENCRYPTION_KEY:');
  console.log(key);
  console.log('----------------------------------------------------');
  
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log('Successfully created local .env file.');
  } else {
    console.log('.env already exists. Use the key above for your Render dashboard.');
  }
}
