// IAP service — stubbed until a Capacitor IAP plugin is configured
// Product IDs for reference: remove_ads, drill_pack_1, season_pass

export const PRODUCT_IDS = {
  REMOVE_ADS: 'remove_ads',
  DRILL_PACK_1: 'drill_pack_1',
  SEASON_PASS: 'season_pass',
} as const

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS]

let storeInitialized = false

export async function initStore(): Promise<void> {
  if (storeInitialized) return
  try {
    // TODO: Replace with real IAP plugin when configured
    // e.g. @revenuecat/purchases-capacitor
    console.log('[IAP] Store initialized (stub)')
    storeInitialized = true
  } catch (e) {
    console.warn('[IAP] Store init failed:', e)
  }
}

export async function purchase(productId: ProductId): Promise<boolean> {
  console.log(`[IAP] Purchase requested: ${productId}`)

  if (!storeInitialized) {
    console.warn('[IAP] Store not initialized')
    return false
  }

  // Stub: simulate successful purchase in dev
  console.log(`[IAP] Simulating successful purchase of ${productId}`)
  return true
}

export async function restorePurchases(): Promise<ProductId[]> {
  console.log('[IAP] Restoring purchases (stub)')
  return []
}
