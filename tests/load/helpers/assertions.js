/**
 * k6 Assertions Helper — Validation de contenu, pas juste le statut HTTP
 *
 * Remplace les checks superficiels `r.status === 200` par des validations
 * de structure, cohérence et intégrité des données.
 */

/**
 * Parse le body JSON d'une réponse, retourne null si invalide.
 */
export function parseBody(res) {
  try { return JSON.parse(res.body); } catch (_e) { return null; }
}

/**
 * Vérifie qu'une réponse REST contient au moins `min` enregistrements.
 * Usage : check(res, assertNonEmpty(res, 'patients', 1));
 */
export function assertNonEmpty(res, label, min = 1) {
  const body = parseBody(res);
  return {
    [`${label}: status 200`]:                          () => res.status === 200,
    [`${label}: body parseable`]:                      () => body !== null,
    [`${label}: ≥${min} enregistrement(s)`]:           () => Array.isArray(body) && body.length >= min,
  };
}

/**
 * Vérifie qu'une réponse REST retourne un tableau (possiblement vide).
 * Plus souple que assertNonEmpty pour les tables qui peuvent être vides.
 */
export function assertQueryOk(res, label) {
  const body = parseBody(res);
  return {
    [`${label}: status 200`]:       () => res.status === 200,
    [`${label}: body parseable`]:   () => body !== null,
    [`${label}: retourne tableau`]: () => Array.isArray(body),
  };
}

/**
 * Vérifie qu'un enregistrement créé (201) contient les champs attendus.
 */
export function assertCreated(res, label, requiredFields = []) {
  const body = parseBody(res);
  const record = Array.isArray(body) ? body?.[0] : body;
  const checks = {
    [`${label}: status 201/200`]: () => res.status === 201 || res.status === 200,
    [`${label}: id présent`]:     () => record?.id !== undefined,
  };
  for (const field of requiredFields) {
    checks[`${label}: champ '${field}' présent`] = () => record?.[field] !== undefined;
  }
  return checks;
}

/**
 * Vérifie qu'un write suivi d'un read retourne le même enregistrement.
 */
export function assertReadAfterWrite(readRes, id, label) {
  const body = parseBody(readRes);
  const found = Array.isArray(body) ? body.find(r => r.id === id) : body;
  return {
    [`${label}: read-after-write status 200`]: () => readRes.status === 200,
    [`${label}: read-after-write cohérent`]:   () => found !== undefined && found?.id === id,
  };
}

/**
 * Vérifie qu'un UPDATE a réussi (200 ou 204).
 */
export function assertUpdated(res, label) {
  return {
    [`${label}: update ok (200/204)`]: () => res.status === 200 || res.status === 204,
  };
}

/**
 * Vérifie qu'une réponse Edge Function ne contient pas d'erreur applicative.
 */
export function assertEdgeFunction(res, label) {
  const body = parseBody(res);
  return {
    [`${label}: status < 500`]:       () => res.status < 500,
    [`${label}: pas d'erreur fatale`]: () => body?.error === undefined || body?.status !== 'error',
    [`${label}: body non vide`]:       () => res.body?.length > 2,
  };
}

/**
 * Vérifie la valeur d'un champ après update.
 */
export function assertFieldValue(readRes, id, field, expectedValue, label) {
  const body = parseBody(readRes);
  const record = Array.isArray(body) ? body.find(r => r.id === id) : body;
  return {
    [`${label}: ${field} = '${expectedValue}'`]: () => record?.[field] === expectedValue,
  };
}
