# College-town home sales

## What this site is for

This site keeps the original city summary table and adds ten data-driven answers
about home prices, campus areas, time on market, taxes, and monthly sales. Q7–Q10
include visitor controls; their answers and charts recalculate from the selected
values.

The Explore section adds shared campus/city, sale-year, bedroom, price, living
area, and garage/basement/fireplace filters. It updates the key numbers, a city
price chart, a location map, a sortable results table, and a two-location
comparison. Filter settings are encoded in the page URL and restored when the
link is opened. Map points use each city's median recorded latitude and
longitude; the dataset does not provide campus landmark coordinates.

## Live site

https://junwei4.github.io/campustown-home-sales-site/

## Data notes

The page reads `data/college_town_home_sales.csv` in the browser. The original
table continues to exclude sales under $10,000 and shows each city's three
highest prices, median, mean, and count. The question sections apply the
question-specific rules shown on the page: the standard valid-price scope is
$10,000–$5,000,000 inclusive, Q2 uses all rows, Q3 compares all rows with valid
prices, and Q9 uses all rows with a sale date. Q7 and Q8 use inclusive visitor
inputs within the valid-price scope; Q10 also applies its campus and bedroom
settings. Q1–Q6 do not change when the Q7–Q10 controls change.

Days on market is calculated as `contract_date` minus `list_date`, and rows
missing either date are excluded from those summaries. The page does not
deduplicate repeated addresses or use the unreliable `home_type` field. See
`docs/data_description_sheet.md` for the dataset caveats and field definitions.
In Explore, unknown feature values remain distinct from Yes and No; a narrowed
living-area range excludes rows with missing living-area values.

## Tools we used

The site uses plain HTML, CSS, and JavaScript with no build step or charting
library. `app.js` loads and parses the CSV once, computes the legacy table and
the ten question answers, and renders SVG charts. `explore.js` applies the
shared filters to the Explore map, chart, comparison, and sortable results.
Google Fonts supplies the open-source DM Sans and Manrope typefaces. GitHub Pages
publishes the repository root using `.github/workflows/pages.yml`.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
