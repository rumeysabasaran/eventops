/** Uygulama saati. Demo sürümünde veri anlık görüntüsünün tarihine sabitlenir. */
let frozenAt: number | null = null

export const setFrozenNow = (iso: string): void => {
  const t = Date.parse(iso)
  if (!Number.isNaN(t)) frozenAt = t
}

export const now = (): Date => new Date(frozenAt ?? Date.now())
