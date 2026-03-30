import { AdMob, RewardAdPluginEvents, RewardAdOptions } from '@capacitor-community/admob'

const REWARDED_AD_ID = 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy' // Replace with real ad unit ID

let initialized = false

export async function initAds(): Promise<void> {
  if (initialized) return
  try {
    await AdMob.initialize({
      initializeForTesting: true,
    })
    initialized = true
    console.log('[Ads] AdMob initialized')
  } catch (e) {
    console.warn('[Ads] AdMob init failed (expected in browser):', e)
  }
}

export async function showRewardedAd(): Promise<boolean> {
  if (!initialized) {
    console.log('[Ads] AdMob not initialized — simulating rewarded ad')
    return true // Simulate reward in dev
  }

  try {
    const options: RewardAdOptions = {
      adId: REWARDED_AD_ID,
    }

    return new Promise<boolean>((resolve) => {
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        resolve(true)
      })

      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        resolve(false)
      })

      AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        console.warn('[Ads] Rewarded ad failed to load')
        resolve(false)
      })

      AdMob.prepareRewardVideoAd(options)
        .then(() => AdMob.showRewardVideoAd())
        .catch(() => {
          console.warn('[Ads] Failed to show rewarded ad')
          resolve(false)
        })
    })
  } catch (e) {
    console.warn('[Ads] Rewarded ad error:', e)
    return false
  }
}
