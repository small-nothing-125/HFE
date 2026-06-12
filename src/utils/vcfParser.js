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

export const parseVCF = (vcfText) => {
  const lines = vcfText.split('\n');
  const results = [];
  const foundRsIDs = new Set();

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    // Split by tabs or spaces
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const id = parts[2];
    const ref = parts[3];
    const alt = parts[4];
    const format = parts.length > 8 ? parts[8] : '';
    const sample = parts.length > 9 ? parts[9] : '';

    const target = TARGET_VARIANTS.find(t => t.id === id);
    if (target) {
      foundRsIDs.add(id);
      
      let userGenotype = ref + '/' + ref; // Default to wild type
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

  // Add missing targets as Wild Type for completeness
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
