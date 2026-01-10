import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const tck = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 3);
export const generateTicketId = () => `${tck()}-${nanoid()}`;
