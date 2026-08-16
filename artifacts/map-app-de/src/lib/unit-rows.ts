import type { UnitOfCompetency } from '@workspace/api-client-react';

export type SpanRow = {
  kind: 'span';
  key: string;
  label: string;
  style: 'element' | 'section' | 'subgroup';
};
export type DataRow = { kind: 'data'; key: string; label: string };
export type Row = SpanRow | DataRow;

export function isSubGroup(text: string) {
  return text.trimEnd().endsWith(':');
}

export function buildRows(unit: UnitOfCompetency): Row[] {
  const rows: Row[] = [];

  for (const el of unit.elements) {
    rows.push({ kind: 'span', key: `el-${el.number}`, label: `${el.number}. ${el.title}`, style: 'element' });
    for (const pc of el.performanceCriteria) {
      rows.push({ kind: 'data', key: `pc-${el.number}-${pc.number}`, label: `${pc.number}  ${pc.text}` });
    }
  }

  const fs = unit.foundationSkills ?? [];
  if (fs.length > 0) {
    rows.push({ kind: 'span', key: 'fs-hdr', label: 'Foundation Skills', style: 'section' });
    fs.forEach((s, i) => {
      if (s.skill) {
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: `${s.skill}:`, style: 'subgroup' });
        rows.push({ kind: 'data', key: `fs-${i}`, label: s.description });
      } else if (isSubGroup(s.description)) {
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: s.description, style: 'subgroup' });
      } else {
        rows.push({ kind: 'data', key: `fs-${i}`, label: `FS ${i + 1}: ${s.description}` });
      }
    });
  }

  const pe = unit.performanceEvidence ?? [];
  if (pe.length > 0) {
    rows.push({ kind: 'span', key: 'pe-hdr', label: 'Performance Evidence', style: 'section' });
    let c = 0;
    pe.forEach((item, i) => {
      if (isSubGroup(item)) rows.push({ kind: 'span', key: `pe-sg-${i}`, label: item, style: 'subgroup' });
      else { c++; rows.push({ kind: 'data', key: `pe-${i}`, label: `PE ${c}: ${item}` }); }
    });
  }

  const ke = unit.knowledgeEvidence ?? [];
  if (ke.length > 0) {
    rows.push({ kind: 'span', key: 'ke-hdr', label: 'Knowledge Evidence', style: 'section' });
    let c = 0;
    ke.forEach((item, i) => {
      if (isSubGroup(item)) rows.push({ kind: 'span', key: `ke-sg-${i}`, label: item, style: 'subgroup' });
      else { c++; rows.push({ kind: 'data', key: `ke-${i}`, label: `KE ${c}: ${item}` }); }
    });
  }

  const ac = unit.assessmentConditions ?? [];
  if (ac.length > 0) {
    rows.push({ kind: 'span', key: 'ac-hdr', label: 'Assessment Conditions', style: 'section' });
    let c = 0;
    ac.forEach((item, i) => {
      if (isSubGroup(item)) rows.push({ kind: 'span', key: `ac-sg-${i}`, label: item, style: 'subgroup' });
      else { c++; rows.push({ kind: 'data', key: `ac-${i}`, label: `AC ${c}: ${item}` }); }
    });
  }

  return rows;
}
