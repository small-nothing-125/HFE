import * as XLSX from 'xlsx';

const TARGET_VARIANTS = [
  {
    id: 'rs1800562',
    gene: 'HFE',
    variantName: 'C282Y',
    type: 'Type 1 (Adult)',
    referenceAllele: 'G',
    pathogenicAllele: 'A',
    description: 'Primary mutation for hereditary hemochromatosis. Homozygosity (A/A) indicates high risk.'
  },
  {
    id: 'rs1799945',
    gene: 'HFE',
    variantName: 'H63D',
    type: 'Type 1 (Adult)',
    referenceAllele: 'C',
    pathogenicAllele: 'G',
    description: 'Secondary mutation. Usually causes milder iron overload unless combined with C282Y (compound heterozygous).'
  },
  {
    id: 'rs1800730',
    gene: 'HFE',
    variantName: 'S65C',
    type: 'Type 1 (Adult)',
    referenceAllele: 'A',
    pathogenicAllele: 'T',
    description: 'Minor variant. Generally associated with very mild or no iron overload.'
  },
  {
    id: 'rs28934596',
    gene: 'HJV',
    variantName: 'G320V',
    type: 'Type 2A (Juvenile)',
    referenceAllele: 'G',
    pathogenicAllele: 'T',
    description: 'Common cause of severe, early-onset juvenile hemochromatosis.'
  },
  {
    id: 'rs104894672',
    gene: 'HAMP',
    variantName: 'R59G',
    type: 'Type 2B (Juvenile)',
    referenceAllele: 'C',
    pathogenicAllele: 'G',
    description: 'A known mutation in the Hepcidin gene causing juvenile hemochromatosis.'
  },
  {
    id: 'rs104894685',
    gene: 'TFR2',
    variantName: 'Y250X',
    type: 'Type 3',
    referenceAllele: 'C',
    pathogenicAllele: 'A',
    description: 'Causes type 3 hemochromatosis, intermediate severity between adult and juvenile.'
  },
  {
    id: 'rs104894696',
    gene: 'SLC40A1',
    variantName: 'V162del',
    type: 'Type 4 (Ferroportin)',
    referenceAllele: 'GTT',
    pathogenicAllele: 'G',
    description: 'Ferroportin disease. Autosomal dominant iron overload.'
  }
];

const TARGET_IDS = new Set(TARGET_VARIANTS.map(v => v.id));

// ── Detect file type from extension ──
export const getFileType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'vcf') return 'vcf';
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'txt') return 'txt';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  return 'unknown';
};

// ── Read an Excel file (ArrayBuffer) into rows of objects ──
export const parseExcel = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // Returns an array of objects keyed by header row
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

// ── Normalise a header name so we can match flexibly ──
const normalise = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const RSID_ALIASES   = ['rsid', 'rsid', 'snp', 'snpid', 'id', 'markerid', 'marker', 'variantid'];
const GENO_ALIASES   = ['genotype', 'geno', 'result', 'call', 'gt'];
const ALLELE1_ALIASES = ['allele1', 'a1'];
const ALLELE2_ALIASES = ['allele2', 'a2'];
const REF_ALIASES     = ['ref', 'reference', 'referenceallele'];
const ALT_ALIASES     = ['alt', 'alternate', 'alternateallele', 'altallele'];
const CHROM_ALIASES   = ['chrom', 'chromosome', 'chr'];

const findCol = (headers, aliases) => {
  for (const h of headers) {
    if (aliases.includes(normalise(h))) return h;
  }
  return null;
};

// ── Parse a tabular row set (from CSV/TSV/Excel) ──
const parseTabular = (rows) => {
  if (!rows || rows.length === 0) return addMissing([]);

  const headers = Object.keys(rows[0]);
  const rsidCol   = findCol(headers, RSID_ALIASES);
  const genoCol   = findCol(headers, GENO_ALIASES);
  const a1Col     = findCol(headers, ALLELE1_ALIASES);
  const a2Col     = findCol(headers, ALLELE2_ALIASES);
  const refCol    = findCol(headers, REF_ALIASES);
  const altCol    = findCol(headers, ALT_ALIASES);

  if (!rsidCol) {
    throw new Error('Could not find an rsID / SNP column in your file. Expected a column named "rsid", "SNP", "Marker", or similar.');
  }

  const results = [];
  const foundRsIDs = new Set();

  for (const row of rows) {
    const id = String(row[rsidCol]).trim();
    if (!TARGET_IDS.has(id)) continue;

    const target = TARGET_VARIANTS.find(t => t.id === id);
    foundRsIDs.add(id);

    // Try to determine the user's genotype from available columns
    let userGenotype = '';
    let isPathogenic = false;

    if (genoCol) {
      // Single genotype column like "AG" or "A/G"
      userGenotype = String(row[genoCol]).trim();
    } else if (a1Col && a2Col) {
      // Two allele columns
      const a1 = String(row[a1Col]).trim();
      const a2 = String(row[a2Col]).trim();
      userGenotype = a1 + '/' + a2;
    } else if (refCol && altCol) {
      // REF/ALT columns (like a simplified VCF)
      const ref = String(row[refCol]).trim();
      const alt = String(row[altCol]).trim();
      if (alt === '.' || alt === '' || alt === ref) {
        userGenotype = ref + '/' + ref;
      } else {
        userGenotype = ref + '/' + alt;
      }
    } else {
      userGenotype = 'Unknown';
    }

    // Normalise separators
    if (userGenotype.length === 2 && !userGenotype.includes('/')) {
      userGenotype = userGenotype[0] + '/' + userGenotype[1];
    }

    const alleles = userGenotype.split('/');
    if (alleles.some(a => a === target.pathogenicAllele)) {
      isPathogenic = true;
    }

    results.push({
      ...target,
      userGenotype,
      isPathogenic,
      rsID: id
    });
  }

  return addMissing(results, foundRsIDs);
};

// ── Parse standard VCF text ──
const parseVCFText = (vcfText) => {
  const lines = vcfText.split('\n');
  const results = [];
  const foundRsIDs = new Set();

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    const parts = line.split(/\t/);
    if (parts.length < 5) continue;

    const id = parts[2];
    const ref = parts[3];
    const alt = parts[4];
    const format = parts.length > 8 ? parts[8] : '';
    const sample = parts.length > 9 ? parts[9] : '';

    const target = TARGET_VARIANTS.find(t => t.id === id);
    if (target) {
      foundRsIDs.add(id);

      let userGenotype = ref + '/' + ref;
      let isPathogenic = false;

      if (format.includes('GT') && sample) {
        const gtIndex = format.split(':').indexOf('GT');
        if (gtIndex !== -1) {
          const gt = sample.split(':')[gtIndex];
          const alleles = gt.split(/[|/]/);

          const alts = alt.split(',');
          const resolvedAlleles = alleles.map(a => {
            if (a === '0') return ref;
            if (a === '.') return '?';
            return alts[parseInt(a) - 1] || '?';
          });

          userGenotype = resolvedAlleles.join('/');
          if (resolvedAlleles.includes(target.pathogenicAllele)) {
            isPathogenic = true;
          }
        }
      } else {
        if (alt !== '.' && alt !== ref) {
          userGenotype = alt;
          isPathogenic = true;
        }
      }

      results.push({
        ...target,
        userGenotype,
        isPathogenic,
        rsID: id
      });
    }
  }

  return addMissing(results, foundRsIDs);
};

// ── Parse a delimited text file (CSV / TSV / TXT) ──
const parseDelimitedText = (text) => {
  // Strip comment lines (common in 23andMe / AncestryDNA exports)
  const lines = text.split('\n').filter(l => !l.startsWith('#') && l.trim() !== '');
  if (lines.length === 0) throw new Error('File appears to be empty.');

  // Auto-detect delimiter
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(',')) delimiter = ',';
  else delimiter = /\s+/;

  const headerParts = typeof delimiter === 'string'
    ? firstLine.split(delimiter)
    : firstLine.split(delimiter);

  // Check if first row looks like a header
  const looksLikeHeader = headerParts.some(h => RSID_ALIASES.includes(normalise(h)));

  if (looksLikeHeader) {
    // Parse as header + data rows
    const headers = headerParts.map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = typeof delimiter === 'string'
        ? lines[i].split(delimiter)
        : lines[i].split(delimiter);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return parseTabular(rows);
  }

  // No header detected – try 23andMe-style (rsid, chromosome, position, genotype)
  // or simple rsid + genotype
  const results = [];
  const foundRsIDs = new Set();

  for (const line of lines) {
    const parts = typeof delimiter === 'string'
      ? line.split(delimiter).map(s => s.trim())
      : line.split(delimiter).map(s => s.trim());

    if (parts.length < 2) continue;

    // Try to find an rsID in any column
    const rsIdx = parts.findIndex(p => /^rs\d+$/i.test(p));
    if (rsIdx === -1) continue;

    const id = parts[rsIdx].toLowerCase();
    if (!TARGET_IDS.has(id)) continue;

    const target = TARGET_VARIANTS.find(t => t.id === id);
    foundRsIDs.add(id);

    // Genotype is typically the last column
    let rawGeno = parts[parts.length - 1];
    let userGenotype = rawGeno;
    if (rawGeno.length === 2 && !rawGeno.includes('/')) {
      userGenotype = rawGeno[0] + '/' + rawGeno[1];
    }

    const alleles = userGenotype.split('/');
    const isPathogenic = alleles.some(a => a === target.pathogenicAllele);

    results.push({
      ...target,
      userGenotype,
      isPathogenic,
      rsID: id
    });
  }

  return addMissing(results, foundRsIDs);
};

// ── Add wild-type entries for variants not found in the file ──
const addMissing = (results, foundRsIDs = new Set()) => {
  TARGET_VARIANTS.forEach(target => {
    if (!foundRsIDs.has(target.id)) {
      results.push({
        ...target,
        userGenotype: target.referenceAllele + '/' + target.referenceAllele + ' (Not found, assumed WT)',
        isPathogenic: false,
        rsID: target.id
      });
    }
  });
  return results;
};

// ── Main entry points ──

/** Parse text-based files (VCF, CSV, TSV, TXT) */
export const parseTextFile = (text, fileType) => {
  if (fileType === 'vcf') {
    // Could be a true VCF or could be a 23andMe-style txt renamed to .vcf
    // Check if it has proper VCF header
    if (text.includes('##fileformat=VCF') || text.includes('#CHROM')) {
      return parseVCFText(text);
    }
    return parseDelimitedText(text);
  }
  return parseDelimitedText(text);
};

/** Parse Excel files from an ArrayBuffer */
export const parseExcelFile = (arrayBuffer) => {
  const rows = parseExcel(arrayBuffer);
  return parseTabular(rows);
};
