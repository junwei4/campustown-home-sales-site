# Agent log

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Copy this outline for each entry:

```markdown
## YYYY-MM-DD: What you worked on

- **Asked:** "Paste your prompt here."
- **Agent produced:** What it made or changed.
- **Checked or changed:** How you checked it, and what you fixed.
```

## 2026-11-11: Adding city median sale prices

- **Asked:** "Read AGENTS.md and docs/data_description_sheet.md first. Then replace the placeholder index.html with a page that shows the median sale price for each city, computed from data/college_town_home_sales.csv. Leave out sales under $10,000 and state that rule on the page."
- **Agent produced:** Replaced the placeholder with a plain HTML page that loads the CSV, filters sale prices below $10,000, computes each city's median in JavaScript, and renders a responsive table.
- **Checked or changed:** Verified all 18 city medians from the CSV with the $10,000 cutoff. The first log edit placed its closing Markdown fence incorrectly; inspection caught and fixed it.
