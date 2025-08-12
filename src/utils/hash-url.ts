export function normalizeUrl(url: string): string {
    const a = new URL(url);
    a.hash = '';

    const kept = [...a.searchParams.entries()].filter(([k]) => !/^utm_/i.test(k));
    a.search = '';
    for (const [k, v] of kept) a.searchParams.append(k, v);

    return a.toString();
}

export function hashUrl(url: string, bits : 128 | 64 = 64): string {
    const s = normalizeUrl(url);
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(s);
    const hex = hasher.digest('hex');
    return bits === 128 ? hex.slice(0, 32) : hex.slice(0, 16);
}