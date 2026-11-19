import { TffLeagueAdapter } from './TffLeagueAdapter.js'

/** Bursaspor home fixtures on the official TFF Trendyol 1. Lig page. */
export class TffTrendyol1LigAdapter extends TffLeagueAdapter {
  constructor() {
    super({
      id: 'tff-trendyol-1-lig',
      name: 'TFF Trendyol 1. Lig (Bursaspor)',
      city: 'Bursa',
      district: 'Osmangazi',
      url: 'https://www.tff.org/default.aspx?pageID=142',
      teamNeedle: 'BURSASPOR',
      leagueLabel: 'Trendyol 1. Lig',
    })
  }
}
