# CAT Pricing Tool

A static, no-build web tool for looking up Command Access Technologies (CAT) list prices and building quotes.

- **Lookup**: search by part number, description or keyword; filter by section.
- **Quote Builder**: add lines with quantity, apply your own net multiplier per line, copy as CSV or print.
- **Discount Calculator**: convert between a net multiplier and a % off.

## Pricing

- The price shown is the **tariff-inclusive list price**: published list x 1.035 (3.5% tariff surcharge), rounded to the dollar.
- Complete hinges and pivots stay at plain list (no tariff). Hinge add-ons are tariffed.
- **No discount tiers are included.** Enter your own multiplier or % off; net = list x multiplier.
- Some rows carry a warning badge (source data conflicts or could not be verified against the catalog PDF). Confirm those with CAT before quoting.
- Catalog page hints cover only part of the data. No hint does not mean the price is wrong.

## Run

Open `index.html` in a browser. No server or install needed.
