# Play Store: sab kuch ek jagah

Play Console me jo bharna hai, uske answers aur graphics yahan hain. Inhe console me copy-paste kar do.

| File | Kya hai | Console me kahan |
| --- | --- | --- |
| [listing.md](listing.md) | App ka naam, short/full description, category, contact | Store presence → Main store listing |
| [graphics/](graphics/) | Icon 512, feature graphic 1024×500 (ready); screenshots abhi lene hain | Main store listing → Graphics |
| [screenshots.md](screenshots.md) | Kaunse screenshots lene hain aur kaise | — |
| [data-safety.md](data-safety.md) | Data safety form ke saare answers | App content → Data safety |
| [app-content.md](app-content.md) | Ads, content rating, target audience (18+), news/govt/financial/health | App content |
| [app-access.md](app-access.md) | Reviewer ka login, aur review mode switch | App content → App access |
| [RELEASE.md](RELEASE.md) | Firebase, upload key, AAB build, upload | Test and release |

## Order

1. Client ka Play developer account banna chahiye, aur hamari email ko release access milna chahiye.
2. [RELEASE.md](RELEASE.md) ke steps 1–2: Firebase me naya Android app aur upload key. Ye sirf ek baar karna hai.
3. Reviewer account banao ([app-access.md](app-access.md)).
4. Screenshots lo ([screenshots.md](screenshots.md)).
5. Listing, data safety aur app content bharo.
6. AAB bana ke Internal testing pe upload karo. Personal account ho to closed test chahiye: 12 testers, 14 din.
7. Review mode ON karo → review ke liye bhejo → approve hone ke baad review mode OFF.

## Rules jo kabhi nahi todne

- App me koi price, offer, "Buy" button, ya WhatsApp/website ka buy link nahi hona chahiye. Course sirf website pe bikta hai.
- Reviewer ka password ya keystore ka password is folder me nahi likhna. Repo public hai. Ye sirf `ACCESS.private.md` me jayega.
- `applicationId` (`com.dhiayurved.app`) ab kabhi nahi badalna.

Graphics dobara banane ho (jaise logo badle): `branding/` me sab logo variants hain. Inhe banane wali script ka zikr `branding/README.md` me hai.
