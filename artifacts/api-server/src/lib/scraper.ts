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

// ── training.gov.au JSON API ───────────────────────────────────────────────────
const TGA = "https://training.gov.au";
const UA = "Mozilla/5.0 (compatible; MapAppDE/1.0; +educational-tool)";

async function tgaFetch(path: string): Promise<unknown> {
  const url = `${TGA}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    redirect: "follow",
  });
  if (res.status === 404) {
    throw Object.assign(new Error(`Not found at ${path}`), { statusCode: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status} from ${path}`), {
      statusCode: 502,
    });
  }
  return res.json();
}

// ── HTML parsers ───────────────────────────────────────────────────────────────

/** Extract plain text paragraphs joined into a single string. */
function parseApplication(html: string): string {
  const $ = cheerio.load(html);
  return $("p")
    .map((_, el) => $(el).text().trim().replace(/\s+/g, " "))
    .get()
    .filter(Boolean)
    .join(" ");
}

/**
 * Parse the Elements & Performance Criteria table.
 * The table has two columns: Element | Performance criteria.
 * Each data row either introduces a new element (left cell has "N. Title")
 * or the left cell is empty (element spans multiple rows).
 */
function parseElements(html: string): Element[] {
  const $ = cheerio.load(html);
  const elements: Element[] = [];
  let current: Element | null = null;

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const left = $(cells[0]);
    const right = $(cells[1]);

    // Skip descriptor rows (italic text explaining what elements/PCs are)
    if (left.find("em").length && !left.find("em").parent().is("p + p")) {
      const allEm = left.find("p").filter((_, p) => $(p).find("em").length > 0).length;
      const total = left.find("p").length;
      if (allEm === total) return; // entirely italic — skip
    }

    const leftText = left
      .text()
      .trim()
      .replace(/\s+/g, " ");

    // Detect element heading: "N. Title"
    const elemMatch = leftText.match(/^(\d+)\.\s+(.+)/s);
    if (elemMatch) {
      current = {
        number: elemMatch[1],
        title: elemMatch[2].trim().replace(/\s+/g, " "),
        performanceCriteria: [],
      };
      elements.push(current);
    }

    // Parse PCs from right cell — each <p> may be one PC
    if (current) {
      right.find("p").each((_, p) => {
        const pcText = $(p)
          .text()
          .trim()
          .replace(/\s+/g, " ");
        const pcMatch = pcText.match(/^(\d+\.\d+)\s+(.+)/s);
        if (pcMatch) {
          current!.performanceCriteria.push({
            number: pcMatch[1],
            text: pcMatch[2].trim(),
          });
        }
      });
    }
  });

  return elements;
}

/**
 * Parse Foundation Skills — may be a 2-col table (skill | description)
 * or prose stating skills are embedded in the PCs.
 */
function parseFoundationSkills(html: string): FoundationSkill[] {
  const $ = cheerio.load(html);
  const skills: FoundationSkill[] = [];

  // Try 2-column table first (skill | description)
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const skill = $(cells[0]).text().trim().replace(/\s+/g, " ");
      const desc = $(cells[1]).text().trim().replace(/\s+/g, " ");
      if (skill && desc && !/^skill/i.test(skill)) {
        skills.push({ skill, description: desc });
      }
    }
  });

  if (skills.length > 0) return skills;

  // Try list items with "Skill – description" pattern
  $("li").each((_, li) => {
    const cloned = $(li).clone();
    cloned.find("ul, ol").remove();
    const text = cloned.text().trim().replace(/\s+/g, " ");
    if (!text) return;

    const m = text.match(/^([^:–\-]+)[:\–\-]\s*(.+)/s);
    if (m) {
      skills.push({ skill: m[1].trim(), description: m[2].trim() });
    } else {
      skills.push({ skill: "", description: text });
    }
  });

  if (skills.length > 0) return skills;

  // Fallback: prose text (e.g. "Foundation skills are explicit in the PCs")
  const prose = $("p")
    .map((_, p) => $(p).text().trim().replace(/\s+/g, " "))
    .get()
    .filter(
      (t) =>
        Boolean(t) &&
        !/^The Foundation Skills describe/i.test(t) &&
        t.length > 10,
    )
    .join(" ");
  if (prose) skills.push({ skill: "", description: prose });

  return skills;
}

/**
 * Extract bullet-point list items from PE / Assessment Conditions HTML.
 * Returns each <li> as a separate string (direct text only, no nested ul content).
 * If no list items, returns paragraph texts.
 */
function parseListSection(html: string): string[] {
  const $ = cheerio.load(html);
  const items: string[] = [];

  $("li").each((_, li) => {
    const cloned = $(li).clone();
    cloned.find("ul, ol").remove();
    const text = cloned.text().trim().replace(/\s+/g, " ");
    if (text) items.push(text);
  });

  if (items.length > 0) return items;

  $("p").each((_, p) => {
    const text = $(p).text().trim().replace(/\s+/g, " ");
    if (text) items.push(text);
  });

  return items;
}

/**
 * Extract only TOP-LEVEL list items (no nested <li> descendants).
 * Used for Knowledge Evidence where sub-bullets are not needed.
 */
function parseTopLevelListSection(html: string): string[] {
  const $ = cheerio.load(html);
  const items: string[] = [];

  // Only li elements that have no li ancestor
  $("li").each((_, li) => {
    if ($(li).parents("li").length > 0) return;
    const cloned = $(li).clone();
    cloned.find("ul, ol").remove();
    const text = cloned.text().trim().replace(/\s+/g, " ");
    if (text) items.push(text);
  });

  if (items.length > 0) return items;

  $("p").each((_, p) => {
    const text = $(p).text().trim().replace(/\s+/g, " ");
    if (text) items.push(text);
  });

  return items;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function scrapeUnit(rawCode: string): Promise<UnitOfCompetency> {
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  logger.info({ code }, "Fetching unit from training.gov.au API");

  // ── Step 1: metadata ──────────────────────────────────────────────────────
  type TgaMeta = {
    code: string;
    title: string;
    usageRecommendationLabel?: string;
    usageRecommendation?: string;
    releases: Array<{ id: string; currency: string; releaseNumber: string }>;
  };
  const meta = (await tgaFetch(`/api/training/${code}`)) as TgaMeta;

  if (!meta?.title) {
    throw Object.assign(
      new Error(`Unit ${code} not found on training.gov.au`),
      { statusCode: 404 },
    );
  }

  const status = meta.usageRecommendationLabel ?? meta.usageRecommendation ?? null;
  const currentRelease =
    meta.releases.find((r) => r.currency === "current") ?? meta.releases[0];

  if (!currentRelease) {
    throw Object.assign(new Error(`No releases found for ${code}`), {
      statusCode: 422,
    });
  }

  // ── Step 2: release → content bundles ────────────────────────────────────
  type TgaRelease = {
    releaseNumber: string;
    contentBundles: Array<{ id: string; typeCode: string }>;
  };
  const release = (await tgaFetch(
    `/api/training/${code}/releases/${currentRelease.id}`,
  )) as TgaRelease;

  // typeCode "0000" = Default (has Application, Elements, Foundation Skills)
  // typeCode "0013" = Assessment Requirements (has PE, KE, AC)
  const mainBundle = release.contentBundles.find((b) => b.typeCode === "0000");
  const assessBundle = release.contentBundles.find((b) => b.typeCode === "0013");

  if (!mainBundle) {
    throw Object.assign(new Error(`No content bundle found for ${code}`), {
      statusCode: 422,
    });
  }

  // ── Step 3: fetch both bundles in parallel ────────────────────────────────
  type ContentItem = {
    contentType: string;
    content: string;
    sequence: number;
  };
  type ContentBundle = { items: ContentItem[] };

  const [mainData, assessData] = await Promise.all([
    tgaFetch(`/api/content/bundle/${mainBundle.id}`) as Promise<ContentBundle>,
    assessBundle
      ? (tgaFetch(`/api/content/bundle/${assessBundle.id}`) as Promise<ContentBundle>)
      : Promise.resolve({ items: [] } as ContentBundle),
  ]);

  const allItems = [...mainData.items, ...assessData.items].sort(
    (a, b) => a.sequence - b.sequence,
  );

  // ── Step 4: parse each content section ───────────────────────────────────
  let description: string | null = null;
  let elements: Element[] = [];
  let foundationSkills: FoundationSkill[] = [];
  let performanceEvidence: string[] = [];
  let knowledgeEvidence: string[] = [];
  let assessmentConditions: string[] = [];

  for (const item of allItems) {
    if (!item.content) continue;

    switch (item.contentType) {
      case "ApplicationOfUnit":
        description = parseApplication(item.content) || null;
        break;
      case "PerformanceCriteria":
        elements = parseElements(item.content);
        break;
      case "FoundationSkills":
        foundationSkills = parseFoundationSkills(item.content);
        break;
      case "PerformanceEvidence":
        performanceEvidence = parseListSection(item.content);
        break;
      case "KnowledgeEvidence":
        knowledgeEvidence = parseTopLevelListSection(item.content);
        break;
      case "AssessmentConditions":
        assessmentConditions = parseListSection(item.content);
        break;
    }
  }

  logger.info(
    {
      code,
      elements: elements.length,
      foundationSkills: foundationSkills.length,
      performanceEvidence: performanceEvidence.length,
      knowledgeEvidence: knowledgeEvidence.length,
      assessmentConditions: assessmentConditions.length,
    },
    "Unit fetched successfully",
  );

  return {
    code,
    title: meta.title,
    release: release.releaseNumber ?? currentRelease.releaseNumber ?? null,
    status,
    description,
    elements,
    foundationSkills,
    performanceEvidence,
    knowledgeEvidence,
    assessmentConditions,
  };
}
