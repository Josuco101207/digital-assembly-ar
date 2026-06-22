function longestCommonPrefix(strs) {
    if (!strs || strs.length === 0) return '';
    if (strs.length === 1) return strs[0];
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (!prefix) return '';
        }
    }
    return prefix;
}

const groups = {
  "group1": ["TBO-42-115814", "TBO-42-115816", "TBO-42-115817", "TBO-42-11581", "TBO-42-115822"],
  "group2": ["PC-4175-318", "PC-4175-318_685"],
  "group3": ["MF53", "MF53_686", "MF53_687"],
  "group4": ["TBO-42-450", "TBO-42-450_684"],
  "group5": ["TBO-42-ROLADO_s-Union1", "TBO-42-ROLADO_s-Union2"],
  "group6": ["101-C42", "101-C421", "101-C422", "101-C423"],
  "group7": ["Base_1", "Base_2", "Base_3"],
  "group8": ["UnrelatedPart1", "CompletelyDifferent2"] // Should ideally not happen if sig is good, but let's test safety
};

for (const [groupId, names] of Object.entries(groups)) {
  let lcp = longestCommonPrefix(names);
  
  // Si el LCP termina en un separador, lo limpiamos (ej. "Base_" -> "Base")
  lcp = lcp.replace(/[-_]$/, '');
  
  // Validar que el LCP sea razonable y no haya cortado demasiado
  // Una regla segura: la diferencia entre el nombre original y el LCP debe ser solo nmeros o separadores + nmeros.
  let isValid = true;
  for (const name of names) {
    const remainder = name.substring(lcp.length);
    // El remainder debe estar vaco, o ser solo dgitos, o empezar con un separador y tener dgitos
    if (remainder.length > 0 && !/^[-_]?\d+$/.test(remainder)) {
      isValid = false;
      break;
    }
  }
  
  if (isValid && lcp.length > 2) {
    console.log(`[${groupId}] SUCCESS: Normalized to -> ${lcp}`);
  } else {
    console.log(`[${groupId}] FAILED: Kept original. (LCP was ${lcp})`);
  }
}
