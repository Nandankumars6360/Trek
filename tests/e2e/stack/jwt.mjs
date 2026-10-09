// Prints anon and service_role keys (HS256 JWTs) for the local test stack.
import crypto from 'node:crypto';

const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
console.log(`ANON_KEY=${sign({ role: 'anon', iss: 'supabase', exp })}`);
console.log(`SERVICE_KEY=${sign({ role: 'service_role', iss: 'supabase', exp })}`);
