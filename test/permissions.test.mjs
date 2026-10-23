import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const P = require('../lib/permissions');
const { MODULES, derivePermissions, deriveTicketPermissions, resolveAccess, migrateLegacyOverrides,
  validateOverride, moduleForPath, clientModel } = P;

const ROLES = ['admin','leitung','dienstplanung','schichtleiter','technik','ausbildung','qm','standard','neuerbereich'];
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm','frei','neuerbereich'];

// Verhalten vor der Umstellung (db.js getP/getTP und fest verdrahtete Prüfungen)
function legacy(roles) {
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  return {
    manageUsers: has('admin'), editAllPersonal: full,
    addForOthers: has('admin','leitung','dienstplanung','ausbildung','qm'),
    addGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    manageGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    seeAllAllw: full, editAllw: full,
    canApproveEvents: has('admin','dienstplanung','leitung'),
    canSendMessages: !has('standard'),
    seeAllAbrechnung: has('admin','dienstplanung'),
    manageSop: has('admin','technik','leitung'),
    canManageDp: has('admin','leitung','dienstplanung'),
    canManageSpint: has('admin','leitung','technik'),
    manageNews: has('admin','leitung'),
    managePlatz: has('admin','leitung','technik'),
    zahnarztEdit: has('admin','technik','leitung','dienstplanung'),
    zahnarztDelete: has('admin','technik'),
    seeAllMessages: has('admin','leitung'),
    manageHomeoffice: has('admin','dienstplanung','leitung'),
    manageDiensttausch: has('admin','dienstplanung','leitung'),
    uploadDienstplaene: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    createDocs: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    createWiki: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    createContacts: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    seeStatistik: has('admin'), manageChecklists: has('admin'),
    tp: {
      seeAll: has('admin','leitung'), myDepts: DEPTS.filter(d => roles.includes(d)),
      canAssign: !has('standard'), canSeeSubcat: has('admin','leitung','schichtleiter','qm'),
    },
  };
}

describe('Standardwerte entsprechen dem bisherigen Verhalten', () => {
  for (const role of ROLES) {
    it(`Rolle ${role}`, () => {
      const p = derivePermissions([role]);
      const tp = deriveTicketPermissions([role], p, DEPTS);
      const old = legacy([role]);
      for (const [k, v] of Object.entries(old)) if (k !== 'tp') expect(p[k], k).toBe(v);
      expect(tp.seeAll).toBe(old.tp.seeAll);
      expect(tp.canAssign).toBe(old.tp.canAssign);
      expect(tp.canSetPublic).toBe(old.tp.canAssign);
      expect(tp.canSeeSubcat).toBe(old.tp.canSeeSubcat);
      expect(tp.myDepts).toEqual(old.tp.myDepts);
    });
  }
  it('Reiter: alle sichtbar außer Dienstplanung/Spind/Statistik für Standard', () => {
    const { tabs } = resolveAccess(['standard']);
    expect(tabs.home).toBe(true);
    expect(tabs.dp).toBe(false);
    expect(tabs.spint).toBe(false);
    expect(tabs.statistik).toBe(false);
    expect(tabs['dp-mine']).toBe(true);
  });
});

describe('mehrere Rollen, Admin, Assessment', () => {
  it('Standard als Zweitrolle nimmt nichts mehr weg', () => {
    const p = derivePermissions(['standard','technik']);
    expect(p.canSendMessages).toBe(true);
    const tp = deriveTicketPermissions(['standard','technik'], p, DEPTS);
    expect(tp.canAssign).toBe(true);
    expect(tp.myDepts).toEqual(['technik']);
  });
  it('höchste Stufe gewinnt', () => {
    expect(derivePermissions(['ausbildung','dienstplanung']).levels.kalender).toBe('verwalten');
  });
  it('Admin hat immer die höchste Stufe, Übersteuerung wirkt nicht', () => {
    const p = derivePermissions(['admin'], [{ role:'admin', permission:'mod:abrechnung', level:'aus' }]);
    for (const m of MODULES) expect(p.levels[m.key]).toBe(m.levels[m.levels.length-1].id);
    expect(p.manageUsers).toBe(true);
  });
  it('Rolle Assessment trägt nichts bei', () => {
    expect(derivePermissions(['assessment','ausbildung']).levels).toEqual(derivePermissions(['ausbildung']).levels);
    expect(derivePermissions(['assessment']).levels.tickets).toBe('aus');
  });
});

describe('Übersteuerungen', () => {
  it('Stufe pro Rolle', () => {
    const ov = [{ role:'leitung', permission:'mod:abrechnung', level:'alle' }];
    expect(derivePermissions(['leitung'], ov).seeAllAbrechnung).toBe(true);
    expect(derivePermissions(['technik'], ov).seeAllAbrechnung).toBe(false);
  });
  it('herabsetzen auf "aus" blendet Reiter aus', () => {
    const p = derivePermissions(['standard'], [{ role:'standard', permission:'mod:chat', level:'aus' }]);
    expect(p.tabs.chat).toBe(false);
  });
  it('unbekannte Stufe wird ignoriert', () => {
    expect(derivePermissions(['standard'], [{ role:'standard', permission:'mod:chat', level:'quatsch' }]).tabs.chat).toBe(true);
  });
  it('Einzelschalter', () => {
    const ov = [{ role:'schichtleiter', permission:'flag:allgemein', granted:true }];
    expect(derivePermissions(['schichtleiter'], ov).addGeneral).toBe(true);
    const off = [{ role:'qm', permission:'flag:beschwerden', granted:false }];
    const p = derivePermissions(['qm'], off);
    expect(deriveTicketPermissions(['qm'], p, DEPTS).canSeeSubcat).toBe(false);
  });
  it('Administration an = volle Rechte', () => {
    expect(derivePermissions(['leitung'], [{ role:'leitung', permission:'mod:administration', level:'an' }]).manageUsers).toBe(true);
  });
  it('validateOverride', () => {
    expect(validateOverride('leitung','mod:abrechnung','alle')).toBeNull();
    expect(validateOverride('leitung','mod:abrechnung','xyz')).toBeTruthy();
    expect(validateOverride('admin','mod:abrechnung','aus')).toBeTruthy();
    expect(validateOverride('assessment','mod:tickets','aus')).toBeTruthy();
    expect(validateOverride('qm','flag:beschwerden',false)).toBeNull();
    expect(validateOverride('qm','flag:beschwerden','ja')).toBeTruthy();
    expect(validateOverride('qm','canSendMessages',true)).toBeTruthy();
  });
});

describe('Übernahme der alten Übersteuerungen', () => {
  it('ohne Abweichung keine neuen Zeilen', () => {
    const rows = ROLES.filter(r => r !== 'admin').map(r => ({ role:r, permission:'canSendMessages', granted: r !== 'standard' }));
    expect(migrateLegacyOverrides(rows).rows).toEqual([]);
  });
  it('alte Einzelrechte werden zu Stufen', () => {
    const { rows } = migrateLegacyOverrides([
      { role:'leitung', permission:'seeAllAbrechnung', granted:true },
      { role:'technik', permission:'canApproveEvents', granted:true },
      { role:'qm', permission:'addGeneral', granted:false },
      { role:'standard', permission:'canSendMessages', granted:true },
      { role:'dienstplanung', permission:'manageUsers', granted:true },
    ]);
    const get = (role, perm) => rows.find(r => r.role === role && r.permission === perm);
    expect(get('leitung','mod:abrechnung').level).toBe('alle');
    expect(get('technik','mod:kalender').level).toBe('genehmigen');
    expect(get('technik','mod:homeoffice').level).toBe('verwalten');
    expect(get('qm','flag:allgemein').granted).toBe(false);
    expect(get('qm','mod:dokumente').level).toBe('lesen');
    expect(get('standard','mod:nachrichten').level).toBe('senden');
    expect(get('dienstplanung','mod:administration').level).toBe('an');
    // Ergebnis wirkt wie vorher
    expect(derivePermissions(['technik'], rows).canApproveEvents).toBe(true);
    expect(derivePermissions(['qm'], rows).addGeneral).toBe(false);
  });
  it('Reiter: Modul nur "aus", wenn alle seine Reiter aus waren', () => {
    const { rows, droppedTabs } = migrateLegacyOverrides([
      { role:'standard', permission:'tab:chat', granted:false },
      { role:'standard', permission:'tab:tickets_deleted', granted:false },
    ]);
    expect(rows).toEqual([{ role:'standard', permission:'mod:chat', granted:true, level:'aus' }]);
    expect(droppedTabs).toBe(1);
  });
  it('bereits umgestellte Zeilen und Admin werden ignoriert', () => {
    expect(migrateLegacyOverrides([
      { role:'admin', permission:'manageUsers', granted:false },
      { role:'leitung', permission:'mod:abrechnung', level:'alle', granted:true },
    ]).rows).toEqual([]);
  });
});

describe('Serversperre und Reiterliste', () => {
  it('moduleForPath', () => {
    expect(moduleForPath('/api/tickets/123/notes')).toBe('tickets');
    expect(moduleForPath('/api/abrechnung/einspringer')).toBe('abrechnung');
    expect(moduleForPath('/api/docs/')).toBe('dokumente');
    expect(moduleForPath('/api/dp/plans')).toBeNull();
    expect(moduleForPath('/api/data')).toBeNull();
    expect(moduleForPath('/api/ticketsX')).toBeNull();
  });
  it('jeder Reiter der Seitenleiste gehört zu genau einem Modul', () => {
    const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    const navIds = JSON.parse(app.match(/const NAV_TAB_IDS=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
    const modTabs = MODULES.flatMap(m => m.tabs);
    expect(new Set(modTabs).size).toBe(modTabs.length);
    expect(navIds.filter(t => t !== 'assessment').sort()).toEqual([...modTabs].sort());
    for (const t of modTabs) expect(html.includes(`id="ni-${t}"`), t).toBe(true);
  });
  it('clientModel nimmt eigene Fachbereiche als Spalte auf', () => {
    const m = clientModel(['technik','neuerbereich','assessment']);
    expect(m.roles).toContain('neuerbereich');
    expect(m.roles).not.toContain('assessment');
    expect(m.roles.filter(r => r === 'technik').length).toBe(1);
  });
});
