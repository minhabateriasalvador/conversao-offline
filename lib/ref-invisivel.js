// Alfabeto base32 sem caracteres ambíguos (sem 0, O, 1, I)
export const BASE32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// 4 caracteres invisíveis (largura zero) para codificar pares de 2 bits
// 00 -> U+200B (Zero Width Space)
// 01 -> U+200C (Zero Width Non-Joiner)
// 10 -> U+200D (Zero Width Joiner)
// 11 -> U+2060 (Word Joiner)
export const ZW_CHARS = ['\u200B', '\u200C', '\u200D', '\u2060'];

// Delimitador início e fim
export const ZW_DELIM = '\u2063';

// Gera uma ref de 6 caracteres aleatórios base32
export function gerarRefCurta() {
  let ref = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    ref += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return ref;
}

// Checksum simples de integridade (4 bits)
export function calcularChecksum(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = (sum * 31 + str.charCodeAt(i)) & 0x0F;
  }
  return sum;
}

// Codifica uma ref para a sequência invisível
export function codificarParaInvisivel(ref) {
  let bits = '';
  for (const char of ref) {
    let val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) val = 0;
    bits += val.toString(2).padStart(5, '0');
  }
  const chk = calcularChecksum(ref);
  bits += chk.toString(2).padStart(4, '0');

  if (bits.length % 2 !== 0) bits += '0';

  let invisivel = ZW_DELIM;
  for (let i = 0; i < bits.length; i += 2) {
    const par = parseInt(bits.substr(i, 2), 2);
    invisivel += ZW_CHARS[par];
  }
  invisivel += ZW_DELIM;
  return invisivel;
}

// Decodifica a string invisível de volta para a ref original
export function decodificarInvisivel(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const inicio = texto.indexOf(ZW_DELIM);
  const fim = texto.lastIndexOf(ZW_DELIM);
  if (inicio === -1 || fim === -1 || inicio === fim) return null;

  const miolo = texto.substring(inicio + 1, fim);
  let bits = '';
  for (const char of miolo) {
    const idx = ZW_CHARS.indexOf(char);
    if (idx !== -1) {
      bits += idx.toString(2).padStart(2, '0');
    }
  }

  if (bits.length < 34) return null;

  let ref = '';
  for (let i = 0; i < 30; i += 5) {
    const val = parseInt(bits.substr(i, 5), 2);
    ref += BASE32_ALPHABET[val];
  }
  return ref;
}
