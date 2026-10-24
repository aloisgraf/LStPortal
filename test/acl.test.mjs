import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { aclAccessInfo, canSeeAcl, canEditAcl } = require('../db');

const J = a => JSON.stringify(a);
const cats = {
  a: { id:'a', name:'Technik', created_by:'x', visible_roles:J(['technik']), editable_roles:J([]), visible_users:J([]), editable_users:J([]) },
  b: { id:'b', name:'Funk', parent_id:'a', created_by:'x', visible_roles:J([]), editable_roles:J([]), visible_users:J(['u1']), editable_users:J(['u1']) },
};
const doc = { id:'d', category_id:'a', created_by:'x', visible_roles:'[]', editable_roles:'[]', visible_users:'[]', editable_users:'[]' };

describe('aclAccessInfo', () => {
  it('Rolle mit Lesen', () => {
    expect(aclAccessInfo(cats.a, 'u2', ['technik'], {}, cats)).toEqual({ access:'lesen', via:'role', roles:['technik'], from:null });
  });
  it('persönlich mit Schreiben', () => {
    expect(aclAccessInfo(cats.b, 'u1', ['standard'], {}, cats)).toMatchObject({ access:'schreiben', via:'user' });
  });
  it('geerbt vom Ordner', () => {
    expect(aclAccessInfo(doc, 'u2', ['technik'], {}, cats)).toMatchObject({ access:'lesen', via:'role', from:'Technik' });
  });
  it('kein Zugriff, Admin, Ersteller', () => {
    expect(aclAccessInfo(cats.a, 'u2', ['standard'], {}, cats)).toBeNull();
    expect(aclAccessInfo(cats.a, 'u2', ['standard'], { manageUsers:true }, cats).via).toBe('admin');
    expect(aclAccessInfo(cats.a, 'x', ['standard'], {}, cats).via).toBe('creator');
  });
  it('stimmt mit canSeeAcl/canEditAcl überein', () => {
    for (const item of [cats.a, cats.b, doc]) for (const [uid, roles] of [['u1',['standard']],['u2',['technik']],['u3',['qm']]]) {
      const info = aclAccessInfo(item, uid, roles, {}, cats);
      expect(!!info && (info.access === 'lesen' || canSeeAcl(item, uid, roles, {}, cats))).toBe(canSeeAcl(item, uid, roles, {}, cats) || canEditAcl(item, uid, roles, {}, cats));
      expect(info?.access === 'schreiben').toBe(canEditAcl(item, uid, roles, {}, cats));
    }
  });
});
