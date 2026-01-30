import crypto from "crypto";

export function gerarRoomId() {
    return crypto.randomUUID();
}
