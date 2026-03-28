import { nanoid, customAlphabet } from "nanoid";
import { REFERRAL_CODE_LENGTH } from "@waitlist/shared";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, REFERRAL_CODE_LENGTH);

export function generateReferralCode(): string {
  return generate();
}

export function generateApiKey(prefix: string): string {
  return `${prefix}${nanoid(32)}`;
}
