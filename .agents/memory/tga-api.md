---
name: training.gov.au API
description: How to fetch unit data from training.gov.au — the site is a Nuxt SPA so HTML scraping returns an empty shell; must use their JSON API
---

## The problem
`training.gov.au/Training/Details/{code}` returns a Nuxt SPA shell: `<div id="__nuxt"></div>`. Plain `fetch` or Cheerio scraping of the page URL returns no content.

## The JSON API (3-step)

1. **Metadata** — `GET /api/training/{CODE}`  
   Returns: `title`, `usageRecommendationLabel` (status), `releases[]` with `{ id, currency, releaseNumber }`.  
   Pick `releases.find(r => r.currency === 'current')` for the current release.

2. **Release details** — `GET /api/training/{CODE}/releases/{releaseId}`  
   Returns: `contentBundles[]` with `{ id, typeCode }`.  
   - `typeCode "0000"` = Default bundle (Application, Elements, Foundation Skills)  
   - `typeCode "0013"` = Assessment Requirements bundle (PE, KE, Assessment Conditions)

3. **Content** — `GET /api/content/bundle/{bundleId}`  
   Returns: `items[]` with `{ contentType, content (HTML string), sequence }`.  
   Content types: `ApplicationOfUnit`, `PerformanceCriteria`, `FoundationSkills`, `PerformanceEvidence`, `KnowledgeEvidence`, `AssessmentConditions`.

## HTML structure of each content type

- **ApplicationOfUnit**: `<p>` tags — join all paragraph texts
- **PerformanceCriteria**: 2-col table (Element | PC). Left cell = "N. Title", right cell = multiple `<p>` tags each "N.N Text". Skip rows where left cell is all `<em>` (descriptor rows).
- **FoundationSkills**: Either a 2-col table (skill | description) OR prose text. Parse table first; fall back to list items or paragraphs.
- **PerformanceEvidence / KnowledgeEvidence / AssessmentConditions**: `<ul><li>` lists (possibly nested). Extract direct text of each `<li>` (strip nested `<ul>` before reading text).

**Why:** The site migrated to Nuxt SSR-disabled in 2025; all content is now API-driven.

**How to apply:** Any time the scraper needs to fetch unit data, use this 3-step API flow. Do not attempt to scrape the `/Training/Details/{code}` page.
