#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const speakappRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(speakappRoot, 'www', 'js', 'data', 'reference-data.json');
const outputPath = path.join(speakappRoot, 'www', 'data', 'reference-lesson-segments.json');

const SEGMENTER_VERSION = 1;
const MIN_CLAUSE_WORDS = 4;

const isTableSeparator = (line) => /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);

const normalizeText = (value) =>
  String(value || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/^\d+[.)]\s+/, '')
    .trim();

const wordCount = (value) => normalizeText(value).split(/\s+/).filter(Boolean).length;

const stripAudioLabel = (value) =>
  normalizeText(value).replace(
    /^(?:Example|Translation|Note|Nota|Exception|Avoid|Tip|Person[ao]? [AB]|Persona [AB])\s*:\s*/i,
    ''
  ).trim();

const splitTableRow = (line) => {
  let value = String(line || '').trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1);
  return value.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
};

const extractBlocks = (markdown, locale) => {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  let blockIndex = 0;
  let inFence = false;

  const addBlock = (type, rawText, extra = {}) => {
    const text = stripAudioLabel(rawText);
    if (!text || /^!\[[^\]]*\]\([^)]*\)$/.test(text)) return;
    if (locale === 'es' && type === 'blockquote' && !/^Example\s*:/i.test(String(rawText).trim())) return;
    blocks.push({
      block_index: blockIndex++,
      type,
      text,
      ...extra
    });
  };

  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (inFence || !line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (locale === 'en') addBlock('heading', heading[2]);
      index += 1;
      continue;
    }

    if (line.trim().startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = splitTableRow(line);
      index += 2;
      let rowIndex = 0;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const cells = splitTableRow(lines[index]);
        cells.forEach((cell, columnIndex) => {
          let source = cell;
          if (locale === 'es') {
            if (!/<\s*br\s*\/?>/i.test(source)) return;
            source = source.split(/<\s*br\s*\/?>/i)[0];
          }
          addBlock('table-cell', source, {
            row_index: rowIndex,
            column_index: columnIndex,
            column_count: header.length
          });
        });
        rowIndex += 1;
        index += 1;
      }
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      const flushQuote = () => {
        if (quoteLines.length) addBlock('blockquote', quoteLines.join(' '));
        quoteLines.length = 0;
      };
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        const quoteText = lines[index].replace(/^\s*>\s?/, '');
        if (!quoteText.trim()) flushQuote();
        else quoteLines.push(quoteText);
        index += 1;
      }
      flushQuote();
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*+] |\d+[.)] )(.+)$/);
    if (listItem) {
      addBlock('list-item', listItem[1]);
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(?:#{1,6}\s|>|```|[-*+] |\d+[.)] |\|)/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (locale === 'en') addBlock('paragraph', paragraphLines.join(' '));
  }

  return blocks;
};

const sentenceSegments = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(normalized), (item) => item.segment.trim()).filter(Boolean);
  }
  return (normalized.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [normalized])
    .map((item) => item.trim())
    .filter(Boolean);
};

const clauseSegments = (sentence) => {
  const text = normalizeText(sentence);

  const boundaries = [];
  const punctuation = /[,;:!?…]|[.](?=\s|$)|[—–]/g;
  let match;
  while ((match = punctuation.exec(text))) {
    const end = match.index + match[0].length;
    const left = text.slice(0, end).trim();
    const right = text.slice(end).trim();
    if (wordCount(left) < MIN_CLAUSE_WORDS || wordCount(right) < MIN_CLAUSE_WORDS) continue;
    if (match[0] === ',' && /^(?:and|or|but|so)\b/i.test(right)) continue;
    boundaries.push(end);
  }

  if (!boundaries.length || wordCount(text) <= MIN_CLAUSE_WORDS * 2) return [text];
  const output = [];
  let start = 0;
  boundaries.forEach((end) => {
    const chunk = text.slice(start, end).trim();
    if (chunk && wordCount(chunk) >= MIN_CLAUSE_WORDS) {
      output.push(chunk);
      start = end;
    }
  });
  const rest = text.slice(start).trim();
  if (rest && (!output.length || wordCount(rest) >= MIN_CLAUSE_WORDS)) output.push(rest);
  if (rest && output.length && wordCount(rest) < MIN_CLAUSE_WORDS) {
    output[output.length - 1] = `${output[output.length - 1]} ${rest}`.trim();
  }
  return output.length ? output : [text];
};

const segmentBlock = (block) =>
  sentenceSegments(block.text).flatMap((sentence) => clauseSegments(sentence));

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const build = () => {
  const sourceRaw = fs.readFileSync(sourcePath, 'utf8');
  const source = loadJson(sourcePath);
  const segments = [];
  let lessonCount = 0;
  let blockCount = 0;

  (Array.isArray(source.cursos) ? source.cursos : []).forEach((course) => {
    (Array.isArray(course.unidades) ? course.unidades : []).forEach((unit) => {
      (Array.isArray(unit.lecciones) ? unit.lecciones : []).forEach((lesson) => {
        lessonCount += 1;
        ['en', 'es'].forEach((locale) => {
          const markdown = lesson.view && typeof lesson.view[locale] === 'string' ? lesson.view[locale] : '';
          const blocks = extractBlocks(markdown, locale);
          blockCount += blocks.length;
          blocks.forEach((block) => {
            segmentBlock(block).forEach((text, segmentIndex) => {
              segments.push({
                id: `${lesson.code}:${locale}:${block.block_index}:${segmentIndex}`,
                course_code: course.code,
                unit_code: unit.code,
                lesson_code: lesson.code,
                locale,
                type: block.type,
                block_index: block.block_index,
                segment_index: segmentIndex,
                text,
                ...(block.row_index !== undefined ? { row_index: block.row_index } : {}),
                ...(block.column_index !== undefined ? { column_index: block.column_index } : {})
              });
            });
          });
        });
      });
    });
  });

  const payload = {
    generator: 'build-reference-lesson-segments',
    schema: 1,
    segmenter_version: SEGMENTER_VERSION,
    source_hash: `sha256-${sha256(sourceRaw)}`,
    generated_at: new Date().toISOString(),
    counts: {
      lessons: lessonCount,
      source_blocks: blockCount,
      segments: segments.length,
      en: segments.filter((segment) => segment.locale === 'en').length,
      es: segments.filter((segment) => segment.locale === 'es').length
    },
    segments
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote: ${outputPath}`);
  console.log(`Counts -> lessons: ${lessonCount}, blocks: ${blockCount}, segments: ${segments.length}`);
  console.log(`Locales -> en: ${payload.counts.en}, es: ${payload.counts.es}`);
};

build();
