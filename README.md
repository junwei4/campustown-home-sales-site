# College-town home sales

## What this site is for

This site keeps the original city summary table and adds ten data-driven answers
about home prices, campus areas, time on market, taxes, and monthly sales. Q7–Q10
include visitor controls; their answers and charts recalculate from the selected
values.

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

## Tools we used

The site uses plain HTML, CSS, and JavaScript with no build step or external
libraries. `app.js` loads and parses the CSV once, computes the legacy table and
the ten question answers, and renders responsive tables and SVG charts. GitHub
Pages publishes the repository root using `.github/workflows/pages.yml`.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
