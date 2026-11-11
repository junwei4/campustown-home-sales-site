# Home sale prices by city

## What this site is for

This site helps people compare home sale prices across the college towns in the
dataset. It shows the three highest qualifying sale prices, the median, the mean,
and the number of qualifying sales for each city.

## Live site

https://junwei4.github.io/campustown-home-sales-site/

## Data notes

The page reads `data/college_town_home_sales.csv` in the browser. It includes all
35,442 source rows and 18 cities. Sales under $10,000 are excluded before
calculating the summaries; 35,402 sales remain. The three highest prices are
selected after filtering, while the median and mean use every qualifying sale in
that city. Values are formatted as whole-dollar US currency.

The $10,000 cutoff addresses the implausible low sale prices described in
`docs/data_description_sheet.md`. The page does not deduplicate repeated
addresses or use the unreliable `home_type` field.

## Tools we used

The site uses plain HTML, CSS, and JavaScript with no build step or external
libraries. The browser loads and parses the CSV, computes each city's summaries,
and renders a responsive table. GitHub Pages publishes the repository root using
`.github/workflows/pages.yml`.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
