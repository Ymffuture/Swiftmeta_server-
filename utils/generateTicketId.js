import { customAlphabet } from "nanoid";

// No confusing chars: no 0, O, I, 1, L
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Generators
const partLetters = customAlphabet(ALPHA, 3);
const partMixedShort = customAlphabet(ALPHANUM, 3);
const partMixedLong = customAlphabet(ALPHANUM, 4);

export const generateTicketId = () => {
  return `${partLetters()}-${partMixedShort()}-${partMixedLong()}`;
};
