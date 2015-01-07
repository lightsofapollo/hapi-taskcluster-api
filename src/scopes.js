import assert from 'assert';
// NOTE: These are taken directly from taskcluster-base

/** Normalize scope sets
 *
 * Normalize a scope-set, basically wrap strings in an extra array if a layer
 * is missing. Examples:
 *    'a'           -> [['a']]        // 'a' must be satisfied
 *    ['a', 'b']    -> [['a'], ['b']] // 'a' or 'b' must be satisfied
 *    [['a', 'b']]  -> [['a', 'b']]   // 'a' and 'b' must be satisfied
 */
export function normalize(scopesets) {
  if (typeof(scopesets) == 'string') {
    scopesets = [[scopesets]];
  }
  return scopesets.map(function(scopeset) {
    if (typeof(scopeset) == 'string') {
      return [scopeset];
    }
    return scopeset;
  });
};

/**
 * Auxiliary function to check if scopePatterns satisfies a scope-set
 *
 * Note that scope-set is an array of arrays of strings on disjunctive normal
 * form without negation. For example:
 *  [['a', 'b'], ['c']]
 *
 * Is satisfied if either,
 *  i)  'a' and 'b' is satisfied, or
 *  ii) 'c' is satisfied.
 *
 * Also expressed as ('a' and 'b') or 'c'.
 */
export function matches (scopePatterns, scopesets) {
  var scopesets = normalize(scopesets);
  if (typeof(scopePatterns) == 'string') {
    scopePatterns = [scopePatterns];
  }
  assert(scopesets instanceof Array, "scopesets must be a string or an array");
  return scopesets.some(function(scopeset) {
    assert(scopesets instanceof Array, "scopeset must be a string or an array");
    return scopeset.every(function(scope) {
      return scopePatterns.some(function(pattern) {
        if (scope === pattern) {
          return true;
        }
        if (/\*$/.test(pattern)) {
          return scope.indexOf(pattern.slice(0, -1)) === 0;
        }
        return false;
      });
    });
  });
};
