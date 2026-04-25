/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Volledige basis-URL van de betalings-API, bv. `https://api.mijnapp.nl` of leeg voor de Vite dev-proxy. */
  readonly VITE_STRIPE_API_URL?: string
  /** In dev: `"1"` om lokaal te ontgrendelen zonder Stripe. */
  readonly VITE_STRIPE_ALLOW_DEMO?: string
  /** `"0"` = verberg de Stripe-knop “munten kopen” in de Shop. */
  readonly VITE_SHOP_COIN_STRIPE?: string
  /** In dev: `"1"` = Likes+ zonder betaling ontgrendelen. */
  readonly VITE_LIKES_DEMO?: string
  /** In dev: `"1"` = Swipey Premium zonder betaling ontgrendelen. */
  readonly VITE_PREMIUM_DEMO?: string
  /** Google OAuth Web Client ID voor echte Google-login. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Callback-URL die ook in Google Cloud Console is toegestaan. */
  readonly VITE_GOOGLE_REDIRECT_URI?: string
  /** Wachtwoord voor het lokale admin panel. */
  readonly VITE_ADMIN_PASSWORD?: string
  /** Publiek IP-adres dat het admin panel mag openen. */
  readonly VITE_ADMIN_ALLOWED_IP?: string
  /**
   * Optioneel: **alleen** de geheime API-sleutel van [Giphy Developers](https://developers.giphy.com/) (Dashboard → “API Keys”).
   * Niet de website-URL (geen `https://giphy.com/`) en niet in dit bestand zetten — in de project-root `.env` als `VITE_GIPHY_API_KEY=...` en `npm run dev` opnieuw starten.
   */
  readonly VITE_GIPHY_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
