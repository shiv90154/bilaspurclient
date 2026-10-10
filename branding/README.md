# DHĪ branding

Saari files client ke diye hue ek hi logo (`admin-web/public/logo.png`, 1254 × 1254, cream background) se bani hain. Original vector (SVG/AI) client ke paas nahi hai.

| File | Kab use karna hai |
| --- | --- |
| `logo-transparent.png` | Poora logo, background ke bina: posters, documents, kisi bhi light background pe |
| `logo-white.png` | Poora logo safed rang me: dark/green background pe |
| `emblem-transparent.png` | Sirf chinh (sir, patte, kitaab), text ke bina: chhoti jagah, watermark |
| `emblem-white.png` | Wahi chinh safed me |
| `emblem-square-1024.png` | Cream square: WhatsApp/YouTube/Instagram profile photo |

## Brand colours (logo se liye)

| Naam | Hex | Kahan |
| --- | --- | --- |
| Forest green | `#1F4D2C` | Main colour, buttons, letters |
| Deep green | `#0D301C` | Headings, dark backgrounds |
| Gold | `#AB803B` | Accent, lines |
| Cream | `#FDFAF3` | Page background |

Ye colours website (`admin-web/src/app/globals.css`) aur app (`student-app/lib/core/theme.dart`) me pehle se lage hue hain.

## Logo se aur kya bana hai

`python branding/make_assets.py .` repo root se chalao (Pillow chahiye). Ye script sab kuch dobara bana deti hai:

- Android app icon: adaptive icon (cream pe chinh), Android 13 ka themed (monochrome) icon, aur purane phones ke liye square icon
- Notification icon: status bar me safed chinh. Pehle poora rangeen icon safed dabba ban ke dikhta tha.
- Splash screen: app khulte waqt cream background pe chinh
- Play Store: `play-store/graphics/icon-512.png`, `feature-graphic-1024x500.png`
- Website: favicon, `icon.png`, `apple-icon.png`. Pehle favicon me poora logo tha, jo 16 px pe padha nahi jata tha.

Client kabhi naya logo de to `admin-web/public/logo.png` aur `student-app/assets/logo.png` replace karo, phir script chalao. Script me chinh ki jagah pixels me likhi hai (`emblem_box`), jo naye logo ke hisaab se badalni padegi.
