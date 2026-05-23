import { customAlphabet } from "nanoid";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const LENGTH = 7;

export const generateShortId = customAlphabet(ALPHABET, LENGTH);
