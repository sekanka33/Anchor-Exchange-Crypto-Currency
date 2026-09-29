import { describe, it, expect, vi } from 'vitest'
import { getCoinsMarkets, getCoinsByCategory, getCoinPrice } from '../api/coingecko'

const okJson = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

describe('market API client', () => {
  it('goes through our own /api/markets proxy, never straight to CoinGecko (keeps the API key server-side)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson([]))
    await getCoinsMarkets()

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('/api/markets/coins')
    expect(url).not.toContain('coingecko.com')
  })

  it('builds the query string from its options', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson([]))
    await getCoinsMarkets({ category: 'layer-1', perPage: 5, page: 2, sparkline: true, priceChangePercentage: '1h,24h' })

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams
    expect(Object.fromEntries(params)).toEqual({
      category: 'layer-1', perPage: '5', page: '2', sparkline: 'true', priceChangePercentage: '1h,24h',
    })
  })

  it('getCoinsByCategory sends category and perPage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson([]))
    await getCoinsByCategory('defi', 4)
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams
    expect(params.get('category')).toBe('defi')
    expect(params.get('perPage')).toBe('4')
  })

  it('URL-encodes ids so a hostile coin id cannot inject extra parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson({}))
    await getCoinPrice('bitcoin&vs_currencies=evil')
    expect(fetchMock.mock.calls[0][0]).toContain('ids=bitcoin%26vs_currencies%3Devil')
  })

  it('throws on a non-OK response instead of returning garbage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) })
    await expect(getCoinsMarkets()).rejects.toThrow('Market data request failed')
  })

  it('returns the parsed JSON body on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => okJson([{ id: 'bitcoin' }]))
    await expect(getCoinsMarkets()).resolves.toEqual([{ id: 'bitcoin' }])
  })
})
