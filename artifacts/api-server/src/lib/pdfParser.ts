// pdf-parse v1 is CJS; use createRequire for compatibility with ESM build
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require("pdf-parse");

import { logger } from "./logger";
import type { UnitOfCompetency, FoundationSkill, Element, PerformanceCriterion } from "./scraper";

export async function parseUnitPdf(buffer: Buffer): Promise<UnitOfCompetency> {
  const data = await pdfParse(buffer);
  logger.info({ chars: data.text.length }, "PDF text extracted");
  return parseUnitText(data.text);
}

function parseUnitText(text: string): UnitOfCompetency {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // ── Code & Title ────────────────────────────────────────────────────────────
  let code = "";
  let title = "";

  for (const line of lines) {
    const codeLineMatch =
      line.match(/unit\s+code[:\s]+([A-Z]{2,6}\d{3,6}[A-Z]?)/i) ||
      line.match(/^([A-Z]{2,6}\d{3,6}[A-Z]?)\s+-\s+(.+)/);

    if (codeLineMatch) {
      code = codeLineMatch[1].trim().toUpperCase();
      if (codeLineMatch[2]) title = codeLineMatch[2].trim();
      continue;
    }

    const titleMatch =
      line.match(/unit\s+title[:\s]+(.+)/i) ||
      (!title && line.match(/unit\s+of\s+competency[:\s]+(.+)/i));
    if (titleMatch) title = titleMatch[1].trim();
  }

  if (!code) {
    for (const line of lines.slice(0, 20)) {
      const m = line.match(/\b([A-Z]{2,6}\d{3,6}[A-Z]?)\b/);
      if (m) { code = m[1]; break; }
    }
  }

  // ── Detect section boundaries ───────────────────────────────────────────────
  const SECTION_PATTERNS: Record<string, RegExp> = {
    application: /^(application|about this unit|overview|description)(\s+of\s+the\s+unit)?$/i,
    elements: /^(elements?\s+and\s+performance\s+criteria|elements?\s*&\s*performance\s+criteria)$/i,
    foundation: /^foundation\s+skills?$/i,
    performance_evidence: /^performance\s+evidence$/i,
    knowledge_evidence: /^knowledge\s+evidence$/i,
    assessment_conditions: /^assessment\s+conditions?$/i,
  };

  type SectionKey = "none" | "application" | "elements" | "foundation" | "performance_evidence" | "knowledge_evidence" | "assessment_conditions";

  let currentSection: SectionKey = "none";

  // ── Buffers ──────────────────────────────────────────────────────────────────
  let description: string | null = null;
  const descriptionLines: string[] = [];
  const elements: Element[] = [];
  let currentElement: Element | null = null;
  const foundationSkills: FoundationSkill[] = [];
  const performanceEvidence: string[] = [];
  const knowledgeEvidence: string[] = [];
  const assessmentConditions: string[] = [];

  for (const line of lines) {
    // Detect section heading
    let detected: SectionKey | null = null;
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line)) { detected = key as SectionKey; break; }
    }
    if (detected) {
      if (currentElement) { elements.push(currentElement); currentElement = null; }
      currentSection = detected;
      continue;
    }

    // Skip column headers
    if (/^(element|performance\s+criteria|skill|description)$/i.test(line)) continue;

    switch (currentSection) {
      case "application":
      case "none": {
        // "none" section: try to grab description from lines before elements
        if (descriptionLines.length < 8 && line.length > 20 && !/^\d+\.\d+/.test(line)) {
          descriptionLines.push(line);
        }
        break;
      }

      case "elements": {
        // Element heading: "1. Title" or "Element 1: Title" or "Element 1 Title"
        const elemMatch =
          line.match(/^element\s+(\d+)[:\s]+(.+)/i) ||
          line.match(/^(\d+)\.\s{1,4}([A-Z].{5,})/);

        if (elemMatch) {
          if (currentElement) elements.push(currentElement);
          currentElement = { number: elemMatch[1], title: elemMatch[2].trim(), performanceCriteria: [] };
          break;
        }

        // PC line: "1.1 ..." or "1.1. ..."
        const pcMatch = line.match(/^(\d+\.\d+)\.?\s+(.+)/);
        if (pcMatch && currentElement) {
          currentElement.performanceCriteria.push({ number: pcMatch[1], text: pcMatch[2].trim() });
          break;
        }

        // Continuation of last PC
        if (currentElement?.performanceCriteria.length && !line.match(/^[A-Z\s]{10,}$/) && line.length > 5) {
          const last = currentElement.performanceCriteria[currentElement.performanceCriteria.length - 1];
          last.text = `${last.text} ${line}`;
        }
        break;
      }

      case "foundation": {
        // "Skill – description" or "Skill: description" or just a description line
        const dashMatch = line.match(/^([^–\-:]+)[–\-:]\s*(.+)/s);
        if (dashMatch) {
          foundationSkills.push({ skill: dashMatch[1].trim(), description: dashMatch[2].trim() });
        } else if (foundationSkills.length > 0 && line.length > 5) {
          // Continuation of previous skill description
          foundationSkills[foundationSkills.length - 1].description +=
            " " + line;
        } else if (line.length > 5) {
          foundationSkills.push({ skill: "", description: line });
        }
        break;
      }

      case "performance_evidence": {
        // Strip leading bullets/dashes/dots
        const cleaned = line.replace(/^[\u2022\u2013\u2014\-\*\.]+\s*/, "");
        if (cleaned.length > 5) performanceEvidence.push(cleaned);
        break;
      }

      case "knowledge_evidence": {
        const cleaned = line.replace(/^[\u2022\u2013\u2014\-\*\.]+\s*/, "");
        if (cleaned.length > 5) knowledgeEvidence.push(cleaned);
        break;
      }

      case "assessment_conditions": {
        const cleaned = line.replace(/^[\u2022\u2013\u2014\-\*\.]+\s*/, "");
        if (cleaned.length > 5) assessmentConditions.push(cleaned);
        break;
      }
    }
  }

  if (currentElement) elements.push(currentElement);
  if (descriptionLines.length > 0) description = descriptionLines.join(" ").trim();

  return {
    code: code || "UNKNOWN",
    title: title || "Unknown Unit",
    release: null,
    status: null,
    description,
    elements,
    foundationSkills,
    performanceEvidence,
    knowledgeEvidence,
    assessmentConditions,
  };
}
