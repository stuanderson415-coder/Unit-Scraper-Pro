import * as cheerio from "cheerio";
import { logger } from "./logger";

export interface PerformanceCriterion {
  number: string;
  text: string;
}

export interface Element {
  number: string;
  title: string;
  performanceCriteria: PerformanceCriterion[];
}

export interface FoundationSkill {
  skill: string;
  description: string;
}

export interface UnitOfCompetency {
  code: string;
  title: string;
  release: string | null;
  status: string | null;
  description: string | null;
  elements: Element[];
  foundationSkills: FoundationSkill[];
  performanceEvidence: string[];
  knowledgeEvidence: string[];
  assessmentConditions: string[];
}

const TGA_BASE = "https://training.gov.au";
const USER_AGENT =
  "Mozilla/5.0 (compatible; MapAppDE/1.0; educational-tool)";

function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function fetchUnitPage(unitCode: string): Promise<string> {
  const url = `${TGA_BASE}/Training/Details/${unitCode}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (response.status === 404) {
    throw Object.assign(new Error(`Unit not found: ${unitCode}`), {
      statusCode: 404,
    });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(`Failed to fetch unit ${unitCode}: HTTP ${response.status}`),
      { statusCode: 502 },
    );
  }

  return response.text();
}

/** Extract text lines from a section that follows a heading matching `pattern`. */
function extractSectionLines(
  $: cheerio.CheerioAPI,
  pattern: RegExp,
): string[] {
  const lines: string[] = [];
  const heading = $("h2, h3, h4, h5")
    .filter((_, el) => pattern.test($(el).text().trim()))
    .first();

  if (!heading.length) return lines;

  // Walk siblings until next heading of same or higher level
  const tagLevel = parseInt(heading.prop("tagName")?.replace("H", "") ?? "3");
  let next = heading.next();

  while (next.length) {
    const tag = next.prop("tagName") ?? "";
    if (/^H[1-6]$/i.test(tag)) {
      const level = parseInt(tag.replace(/h/i, ""));
      if (level <= tagLevel) break;
    }

    // Table rows (foundation skills are often in a 2-col table)
    if (next.is("table")) {
      next.find("tr").each((_, row) => {
        const cells = $(row).find("td, th");
        if (cells.length >= 2) {
          const text = cells
            .map((_, c) => $(c).text().trim())
            .get()
            .join(": ");
          if (text.trim()) lines.push(text.trim());
        } else if (cells.length === 1) {
          const text = $(cells[0]).text().trim();
          if (text) lines.push(text);
        }
      });
    }

    // List items
    next.find("li").each((_, li) => {
      const text = $(li).text().trim();
      if (text) lines.push(text);
    });

    // Paragraphs / divs with direct text
    if (next.is("p, div") && !next.find("li, tr").length) {
      const text = next.text().trim();
      if (text) lines.push(text);
    }

    next = next.next();
  }

  return lines.filter(Boolean);
}

/** Parse foundation skills from a 2-column table (skill | description). */
function extractFoundationSkills(
  $: cheerio.CheerioAPI,
): FoundationSkill[] {
  const skills: FoundationSkill[] = [];

  const heading = $("h2, h3, h4, h5")
    .filter((_, el) => /foundation\s*skill/i.test($(el).text()))
    .first();

  if (!heading.length) return skills;

  const tagLevel = parseInt(heading.prop("tagName")?.replace("H", "") ?? "3");
  let next = heading.next();

  while (next.length) {
    const tag = next.prop("tagName") ?? "";
    if (/^H[1-6]$/i.test(tag)) {
      const level = parseInt(tag.replace(/h/i, ""));
      if (level <= tagLevel) break;
    }

    if (next.is("table")) {
      next.find("tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 2) {
          const skill = $(cells[0]).text().trim();
          const desc = $(cells[1]).text().trim();
          if (skill && desc && !/^skill/i.test(skill)) {
            skills.push({ skill, description: desc });
          }
        }
      });
    }

    // Some pages use list items like "Reading – interprets..."
    if (!next.is("table")) {
      next.find("li").each((_, li) => {
        const text = $(li).text().trim();
        const dashMatch = text.match(/^([^–\-:]+)[–\-:]\s*(.+)/s);
        if (dashMatch) {
          skills.push({
            skill: dashMatch[1].trim(),
            description: dashMatch[2].trim(),
          });
        } else if (text) {
          skills.push({ skill: "", description: text });
        }
      });
    }

    next = next.next();
  }

  return skills;
}

export async function scrapeUnit(rawCode: string): Promise<UnitOfCompetency> {
  const unitCode = normaliseCode(rawCode);
  logger.info({ unitCode }, "Scraping unit from training.gov.au");

  const html = await fetchUnitPage(unitCode);
  const $ = cheerio.load(html);

  // ── Title ──────────────────────────────────────────────────────────────────
  let title =
    $("h1.unit-title").text().trim() ||
    $('[class*="unit-title"]').first().text().trim() ||
    $(".training-component-title h1").text().trim() ||
    $("h1").first().text().trim();

  title = title.replace(/^[A-Z]{2,6}\d{3,6}[A-Z]?\s*[-–]\s*/i, "").trim();

  // ── Status / Release ───────────────────────────────────────────────────────
  const status =
    $('[class*="training-status"]').first().text().trim() ||
    $(".status").first().text().trim() ||
    null;

  const release =
    $('[class*="release"]').first().text().trim() ||
    $('td:contains("Release")').next().text().trim() ||
    null;

  // ── Description / Application ──────────────────────────────────────────────
  let description: string | null = null;
  const appLabel = $("h2, h3, h4")
    .filter((_, el) =>
      /application|about this unit|overview|description/i.test($(el).text()),
    )
    .first();
  if (appLabel.length) {
    description = appLabel.next("p, div").text().trim() || null;
  }

  // ── Elements & Performance Criteria ────────────────────────────────────────
  const elements: Element[] = [];

  const elementBlocks = $(
    ".element-block, .element-container, [class*='element-block'], [class*='elements-pcs']",
  );

  if (elementBlocks.length > 0) {
    elementBlocks.each((_i, block) => {
      const heading = $(block).find("h2, h3, h4, .element-title").first().text().trim();
      const numMatch = heading.match(/^(\d+)[\.\s]+(.+)/);
      const elemNumber = numMatch ? numMatch[1] : String(elements.length + 1);
      const elemTitle = numMatch ? numMatch[2].trim() : heading;

      const pcs: PerformanceCriterion[] = [];

      $(block)
        .find("table tr, .pc-row")
        .each((_j, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const num = $(cells[0]).text().trim();
            const text = $(cells[1]).text().trim();
            if (num && text && /^\d+\.\d+/.test(num)) {
              pcs.push({ number: num, text });
            }
          }
        });

      if (pcs.length === 0) {
        $(block)
          .find("li, .pc-item")
          .each((_j, item) => {
            const text = $(item).text().trim();
            const m = text.match(/^(\d+\.\d+)\s+(.+)/s);
            if (m) pcs.push({ number: m[1], text: m[2].trim() });
          });
      }

      if (elemTitle) {
        elements.push({ number: elemNumber, title: elemTitle, performanceCriteria: pcs });
      }
    });
  }

  if (elements.length === 0) {
    $("h2, h3, h4").each((_i, heading) => {
      const text = $(heading).text().trim();
      const numMatch = text.match(/^(?:element\s+)?(\d+)[\.\s:]+(.+)/i);
      if (!numMatch) return;

      const elemNumber = numMatch[1];
      const elemTitle = numMatch[2].trim();
      const pcs: PerformanceCriterion[] = [];

      let next = $(heading).next();
      while (next.length && !next.is("h2, h3, h4") && pcs.length < 30) {
        next.find("tr").each((_j, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const num = $(cells[0]).text().trim();
            const pcText = $(cells[1]).text().trim();
            if (/^\d+\.\d+/.test(num)) pcs.push({ number: num, text: pcText });
          }
        });
        next.find("li").each((_j, li) => {
          const liText = $(li).text().trim();
          const m = liText.match(/^(\d+\.\d+)\s+(.+)/s);
          if (m) pcs.push({ number: m[1], text: m[2].trim() });
        });
        next = next.next();
      }

      elements.push({ number: elemNumber, title: elemTitle, performanceCriteria: pcs });
    });
  }

  // Strategy 3: text regex fallback
  if (elements.length === 0) {
    logger.warn({ unitCode }, "CSS strategies failed; falling back to text regex scan");
    const bodyText = $("body").text();
    const elementPattern = /(\d+)\.\s+([A-Z][^\n]+)\n((?:\s*\d+\.\d+[^\n]+\n?)+)/gm;
    let match;
    while ((match = elementPattern.exec(bodyText)) !== null) {
      const pcs: PerformanceCriterion[] = [];
      const pcPattern = /(\d+\.\d+)\s+([^\n]+)/g;
      let pcMatch;
      while ((pcMatch = pcPattern.exec(match[3])) !== null) {
        pcs.push({ number: pcMatch[1], text: pcMatch[2].trim() });
      }
      if (pcs.length > 0) {
        elements.push({ number: match[1], title: match[2].trim(), performanceCriteria: pcs });
      }
    }
  }

  // ── Foundation Skills ──────────────────────────────────────────────────────
  const foundationSkills = extractFoundationSkills($);

  // ── Performance Evidence ───────────────────────────────────────────────────
  const performanceEvidence = extractSectionLines($, /performance\s+evidence/i);

  // ── Knowledge Evidence ─────────────────────────────────────────────────────
  const knowledgeEvidence = extractSectionLines($, /knowledge\s+evidence/i);

  // ── Assessment Conditions ──────────────────────────────────────────────────
  const assessmentConditions = extractSectionLines($, /assessment\s+conditions?/i);

  if (!title) {
    throw Object.assign(
      new Error(`Could not parse unit page for ${unitCode}`),
      { statusCode: 422 },
    );
  }

  logger.info(
    {
      unitCode,
      elementCount: elements.length,
      foundationSkillCount: foundationSkills.length,
      performanceEvidenceCount: performanceEvidence.length,
      knowledgeEvidenceCount: knowledgeEvidence.length,
      assessmentConditionCount: assessmentConditions.length,
    },
    "Scrape complete",
  );

  return {
    code: unitCode,
    title,
    release: release || null,
    status: status || null,
    description,
    elements,
    foundationSkills,
    performanceEvidence,
    knowledgeEvidence,
    assessmentConditions,
  };
}
