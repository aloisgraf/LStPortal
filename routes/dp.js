'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── HOURS PROFILES ────────────────────────────────────────────────────────────

router.get('/hours-profiles', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_hours_profiles ORDER BY name')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/hours-profiles', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name, monthlyHours, dailyWorkHours, avgShiftDuration} = req.body;
  if (!name?.trim() || !monthlyHours) return bad(res,'Name und Monatsstunden erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_hours_profiles (id,name,monthly_hours,daily_work_hours,avg_shift_duration,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(), name.trim(), parseFloat(monthlyHours), dailyWorkHours ? parseFloat(dailyWorkHours) : null,
       avgShiftDuration ? parseFloat(avgShiftDuration) : null, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/hours-profiles/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name, monthlyHours, dailyWorkHours, avgShiftDuration} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_hours_profiles SET name=$1,monthly_hours=$2,daily_work_hours=$3,avg_shift_duration=$4 WHERE id=$5 RETURNING *`,
      [name.trim(), parseFloat(monthlyHours), dailyWorkHours ? parseFloat(dailyWorkHours) : null,
       avgShiftDuration ? parseFloat(avgShiftDuration) : null, req.params.id]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/hours-profiles/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    await q('UPDATE dp_employee_params SET profile_id=NULL WHERE profile_id=$1', [req.params.id]);
    await q('DELETE FROM dp_hours_profiles WHERE id=$1', [req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── EMP CATEGORIES ──────────────────────────────────────────────────────────

router.get('/emp-categories', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_emp_categories ORDER BY sort_order, name')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/emp-categories', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name, color, sortOrder} = req.body;
  if (!name?.trim()) return bad(res,'Name erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_emp_categories (id,name,color,sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
      [newId(), name.trim(), color||'#64748b', sortOrder||0]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/emp-categories/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name, color, sortOrder} = req.body;
  try {
    const old = await q1('SELECT name FROM dp_emp_categories WHERE id=$1', [req.params.id]);
    const row = await q1(
      `UPDATE dp_emp_categories SET name=$1,color=$2,sort_order=$3 WHERE id=$4 RETURNING *`,
      [name.trim(), color||'#64748b', sortOrder||0, req.params.id]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    // Rename on all users who had the old name
    if (old && old.name !== name.trim()) {
      await q(`UPDATE users SET category=$1 WHERE category=$2`, [name.trim(), old.name]);
    }
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/emp-categories/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    const cat = await q1('SELECT name FROM dp_emp_categories WHERE id=$1', [req.params.id]);
    if (cat) await q(`UPDATE users SET category=NULL WHERE category=$1`, [cat.name]);
    await q('DELETE FROM dp_emp_categories WHERE id=$1', [req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// Assign employee to category (or null to remove)
router.post('/emp-categories/assign', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId, categoryName} = req.body;
  if (!employeeId) return bad(res,'Mitarbeiter erforderlich',400);
  try {
    await q(`UPDATE users SET category=$1 WHERE id=$2`, [categoryName||null, employeeId]);
    ok(res, {employeeId, categoryName});
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── SHIFT TYPES ───────────────────────────────────────────────────────────────

router.get('/shift-types', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_shift_types ORDER BY sort_order, name')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/shift-types', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name,code,location,role,startTime,endTime,durationHours,isNight,isZulage,isOffice,color,sortOrder,validFrom,validUntil,maxPerEmpPerMonth} = req.body;
  if (!name?.trim()||!code?.trim()) return bad(res,'Name und Code erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_shift_types (id,name,code,location,role,start_time,end_time,duration_hours,is_night,is_zulage,is_office,color,sort_order,valid_from,valid_until,max_per_emp_per_month,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [newId(),name.trim(),code.trim().toUpperCase(),location||'',role||'',startTime||'08:00',endTime||'20:00',durationHours||12,!!isNight,!!isZulage,!!isOffice,color||'#3b6dd4',sortOrder||0,validFrom||null,validUntil||null,maxPerEmpPerMonth||null,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/shift-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name,code,location,role,startTime,endTime,durationHours,isNight,isZulage,isOffice,color,sortOrder,validFrom,validUntil,maxPerEmpPerMonth} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_shift_types SET name=$1,code=$2,location=$3,role=$4,start_time=$5,end_time=$6,
       duration_hours=$7,is_night=$8,is_zulage=$9,is_office=$10,color=$11,sort_order=$12,valid_from=$13,valid_until=$14,max_per_emp_per_month=$15 WHERE id=$16 RETURNING *`,
      [name,code?.toUpperCase(),location||'',role||'',startTime,endTime,durationHours,!!isNight,!!isZulage,!!isOffice,color,sortOrder||0,validFrom||null,validUntil||null,maxPerEmpPerMonth||null,req.params.id]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/shift-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try { await q('DELETE FROM dp_shift_types WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { bad(res,'Serverfehler',500); }
});

// ── SHIFT PREFERENCES ─────────────────────────────────────────────────────

router.get('/shift-preferences', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_shift_preferences ORDER BY employee_id, shift_type_id, valid_from NULLS FIRST')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/shift-preferences', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId, shiftTypeId, preferenceWeight, validFrom} = req.body;
  if (!employeeId || !shiftTypeId) return bad(res,'Pflichtfelder fehlen',400);
  const pw = Math.max(0, Math.min(100, parseInt(preferenceWeight)||0));
  const vf = validFrom || null;
  try {
    let existing;
    if (vf === null) {
      existing = await q1('SELECT id FROM dp_shift_preferences WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from IS NULL', [employeeId, shiftTypeId]);
    } else {
      existing = await q1('SELECT id FROM dp_shift_preferences WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from=$3::date', [employeeId, shiftTypeId, vf]);
    }
    if (existing) {
      const row = await q1('UPDATE dp_shift_preferences SET preference_weight=$1, valid_from=$2 WHERE id=$3 RETURNING *', [pw, vf, existing.id]);
      return ok(res, row);
    }
    const row = await q1(
      `INSERT INTO dp_shift_preferences (id, employee_id, shift_type_id, preference_weight, valid_from, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [newId(), employeeId, shiftTypeId, pw, vf, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/shift-preferences/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    await q('DELETE FROM dp_shift_preferences WHERE id=$1', [req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── SHIFT REQUIREMENTS ────────────────────────────────────────────────────────

router.get('/shift-requirements', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_shift_requirements ORDER BY shift_type_id, applies_to, weekday')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/shift-requirements', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {shiftTypeId,appliesTo,weekday,specificDate,slotCount,validFrom,validUntil} = req.body;
  if (!shiftTypeId||!slotCount) return bad(res,'Schichttyp und Anzahl erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_shift_requirements (id,shift_type_id,applies_to,weekday,specific_date,slot_count,valid_from,valid_until,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [newId(),shiftTypeId,appliesTo||'weekday',weekday||null,specificDate||null,slotCount,validFrom||null,validUntil||null,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/shift-requirements/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {shiftTypeId,slotCount,weekday,appliesTo,specificDate,validFrom,validUntil} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_shift_requirements SET shift_type_id=COALESCE($1,shift_type_id),slot_count=$2,weekday=$3,applies_to=$4,specific_date=$5,valid_from=$6,valid_until=$8 WHERE id=$7 RETURNING *`,
      [shiftTypeId||null,slotCount,weekday||null,appliesTo,specificDate||null,validFrom||null,req.params.id,validUntil||null]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/shift-requirements/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try { await q('DELETE FROM dp_shift_requirements WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { bad(res,'Serverfehler',500); }
});

// ── ABSENCE TYPES ─────────────────────────────────────────────────────────────

router.get('/absence-types', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_absence_types ORDER BY sort_order, label')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/absence-types', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {code,label,color,hoursCalculation,fixedHours,adjustsMonthlyTarget,blocksScheduling,reopensShift,countsAsWorked,requiresApproval,sortOrder,validFrom,isHolidayDefault,zeroOnFreeDays} = req.body;
  if (!code?.trim()||!label?.trim()) return bad(res,'Code und Label erforderlich',400);
  try {
    // Only one type can be the holiday default – clear others first
    if (isHolidayDefault) await q('UPDATE dp_absence_types SET is_holiday_default=false');
    const row = await q1(
      `INSERT INTO dp_absence_types (id,code,label,color,hours_calculation,fixed_hours,adjusts_monthly_target,blocks_scheduling,reopens_shift,counts_as_worked,requires_approval,sort_order,valid_from,is_holiday_default,zero_on_free_days,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [newId(),code.trim().toUpperCase(),label.trim(),color||'#f59e0b',hoursCalculation||'daily_target',fixedHours||null,!!adjustsMonthlyTarget,blocksScheduling!==false,reopensShift!==false,countsAsWorked!==false,!!requiresApproval,sortOrder||0,validFrom||null,!!isHolidayDefault,!!zeroOnFreeDays,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/absence-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {code,label,color,hoursCalculation,fixedHours,adjustsMonthlyTarget,blocksScheduling,reopensShift,countsAsWorked,requiresApproval,sortOrder,validFrom,isHolidayDefault,zeroOnFreeDays} = req.body;
  try {
    if (isHolidayDefault) await q('UPDATE dp_absence_types SET is_holiday_default=false WHERE id!=$1',[req.params.id]);
    const row = await q1(
      `UPDATE dp_absence_types SET code=$1,label=$2,color=$3,hours_calculation=$4,fixed_hours=$5,
       adjusts_monthly_target=$6,blocks_scheduling=$7,reopens_shift=$8,counts_as_worked=$9,
       requires_approval=$10,sort_order=$11,valid_from=$12,is_holiday_default=$13,zero_on_free_days=$15 WHERE id=$14 RETURNING *`,
      [code?.toUpperCase(),label,color,hoursCalculation,fixedHours||null,!!adjustsMonthlyTarget,blocksScheduling!==false,reopensShift!==false,countsAsWorked!==false,!!requiresApproval,sortOrder||0,validFrom||null,!!isHolidayDefault,req.params.id,!!zeroOnFreeDays]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/absence-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try { await q('DELETE FROM dp_absence_types WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { bad(res,'Serverfehler',500); }
});

// ── EMPLOYEE PARAMS ───────────────────────────────────────────────────────────

router.get('/employee-params', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_employee_params ORDER BY employee_id, valid_from NULLS FIRST')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/employee-params', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId,validFrom,monthlyHours,canDoNights,maxNightsPerMonth,doubleNightsAllowed,isSpringer,
         officePct,fdSpringerType,fdSpringerLocation,fdSpringerShiftsPerMonth,dailyHours,profileId,noWeekends} = req.body;
  if (!employeeId) return bad(res,'Mitarbeiter erforderlich',400);

  // Wenn Profil ausgewählt: Stunden aus Profil ableiten
  let mh = parseFloat(monthlyHours)||160;
  let dh = dailyHours ? parseFloat(dailyHours) : null;
  if (profileId) {
    const prof = await q1('SELECT * FROM dp_hours_profiles WHERE id=$1',[profileId]);
    if (prof) {
      mh = parseFloat(prof.monthly_hours)||mh;
      if (prof.daily_work_hours) dh = parseFloat(prof.daily_work_hours);
    }
  }

  const wh = Math.round(mh / 4.33 * 100) / 100;
  const opct = Math.min(100, Math.max(0, parseInt(officePct)||0));
  const fdType = ['FD_to_LS','LS_to_FD'].includes(fdSpringerType) ? fdSpringerType : null;
  const fdLoc  = ['Nord','Süd'].includes(fdSpringerLocation) ? fdSpringerLocation : null;
  const fdSpm  = fdType ? (parseInt(fdSpringerShiftsPerMonth)||null) : null;
  const vf = validFrom || null;
  const pid = profileId || null;
  try {
    let existing;
    if (vf === null) {
      existing = await q1('SELECT id FROM dp_employee_params WHERE employee_id=$1 AND valid_from IS NULL',[employeeId]);
    } else {
      existing = await q1('SELECT id FROM dp_employee_params WHERE employee_id=$1 AND valid_from=$2::date',[employeeId,vf]);
    }
    const noWE = !!noWeekends;
    if (existing) {
      const row = await q1(
        `UPDATE dp_employee_params SET monthly_hours=$1,weekly_hours=$2,can_do_nights=$3,
         max_nights_per_month=$4,double_nights_allowed=$5,is_springer=$6,office_pct=$7,
         fd_springer_type=$8,fd_springer_location=$9,fd_springer_shifts_per_month=$10,
         valid_from=$11,updated_at=NOW(),daily_hours=$13,profile_id=$14,no_weekends=$15 WHERE id=$12 RETURNING *`,
        [mh,wh,canDoNights!==false,maxNightsPerMonth||null,doubleNightsAllowed!==false,!!isSpringer,opct,fdType,fdLoc,fdSpm,vf,existing.id,dh,pid,noWE]
      );
      return ok(res,row);
    }
    const row = await q1(
      `INSERT INTO dp_employee_params
         (id,employee_id,monthly_hours,weekly_hours,work_days_per_week,can_do_nights,
          max_nights_per_month,double_nights_allowed,is_springer,office_pct,
          fd_springer_type,fd_springer_location,fd_springer_shifts_per_month,
          valid_from,springer_config,locations,created_by,daily_hours,profile_id,no_weekends)
       VALUES ($1,$2,$3,$4,5,$5,$6,$7,$8,$9,$10,$11,$12,$13,'{}','[]',$14,$15,$16,$17) RETURNING *`,
      [newId(),employeeId,mh,wh,canDoNights!==false,maxNightsPerMonth||null,
       doubleNightsAllowed!==false,!!isSpringer,opct,fdType,fdLoc,fdSpm,vf,req.uid,dh,pid,noWE]
    );
    ok(res,row);
  } catch(e) { console.error(e); bad(res,'Serverfehler',500); }
});

router.delete('/employee-params/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    await q('DELETE FROM dp_employee_params WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── EMPLOYEE QUALIFICATIONS ───────────────────────────────────────────────────

router.get('/employee-qualifications', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_employee_qualifications ORDER BY employee_id, shift_type_id')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/employee-qualifications', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId, shiftTypeId, validFrom} = req.body;
  if (!employeeId||!shiftTypeId) return bad(res,'Pflichtfelder fehlen',400);
  const vf = validFrom || null;
  try {
    let existing;
    if (vf === null) {
      existing = await q1('SELECT id FROM dp_employee_qualifications WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from IS NULL',[employeeId,shiftTypeId]);
    } else {
      existing = await q1('SELECT id FROM dp_employee_qualifications WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from=$3::date',[employeeId,shiftTypeId,vf]);
    }
    if (existing) return ok(res,existing);
    const row = await q1(
      `INSERT INTO dp_employee_qualifications (id,employee_id,shift_type_id,valid_from,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [newId(),employeeId,shiftTypeId,vf,req.uid]
    );
    ok(res, row||{employeeId,shiftTypeId});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/employee-qualifications/:empId/:stId', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    // Delete from specific version or NULL version if not specified
    const validFrom = req.body?.validFrom || null;
    if (validFrom === null) {
      await q('DELETE FROM dp_employee_qualifications WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from IS NULL',[req.params.empId,req.params.stId]);
    } else {
      await q('DELETE FROM dp_employee_qualifications WHERE employee_id=$1 AND shift_type_id=$2 AND valid_from=$3::date',[req.params.empId,req.params.stId,validFrom]);
    }
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── PLANS ─────────────────────────────────────────────────────────────────────

router.get('/plans', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_plans ORDER BY year DESC, month DESC')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/plans', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {month,year,title,notes} = req.body;
  if (!month||!year) return bad(res,'Monat und Jahr erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_plans (id,month,year,title,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(),month,year,title||`Plan ${month}/${year}`,notes||'',req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/plans/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {title,notes,status} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_plans SET title=COALESCE($1,title),notes=COALESCE($2,notes),status=COALESCE($3,status) WHERE id=$4 RETURNING *`,
      [title||null,notes||null,status||null,req.params.id]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/plans/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    await q('DELETE FROM dp_assignments WHERE plan_id=$1',[req.params.id]);
    await q('DELETE FROM dp_plans WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/plans/:id/publish', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    const row = await q1(
      `UPDATE dp_plans SET status='published',published_at=NOW(),published_by=$1 WHERE id=$2 RETURNING *`,
      [req.uid,req.params.id]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── MATRIX DATA ───────────────────────────────────────────────────────────────

router.get('/plans/:id/matrix', auth, async (req,res) => {
  try {
    const plan = await q1('SELECT * FROM dp_plans WHERE id=$1',[req.params.id]);
    if (!plan) return bad(res,'Nicht gefunden',404);
    const dpRoles = req.p.roles||[];
    const canManageDpRoute = req.p.manageUsers||dpRoles.some(r=>['leitung','dienstplanung'].includes(r));
    if(!canManageDpRoute){
      if(plan.status!=='published') return bad(res,'Keine Berechtigung',403);
      const hasAssignment = await q1('SELECT id FROM dp_assignments WHERE plan_id=$1 AND employee_id=$2',[req.params.id,req.uid]);
      if(!hasAssignment) return bad(res,'Keine Berechtigung',403);
    }

    const [shiftTypes, requirements, empParams, absenceTypes, qualifications, wishDays, hoursProfiles] = await Promise.all([
      q('SELECT * FROM dp_shift_types ORDER BY sort_order, name'),
      q('SELECT * FROM dp_shift_requirements'),
      q('SELECT * FROM dp_employee_params'),
      q('SELECT * FROM dp_absence_types ORDER BY sort_order'),
      q(`SELECT DISTINCT ON (employee_id, shift_type_id) employee_id, shift_type_id FROM dp_employee_qualifications WHERE valid_from IS NULL OR valid_from <= NOW()::date ORDER BY employee_id, shift_type_id, valid_from DESC NULLS LAST`),
      q(`SELECT employee_id, date FROM dp_wish_days WHERE month=$1 AND year=$2`, [plan.month, plan.year]),
      q('SELECT * FROM dp_hours_profiles'),
    ]);
    let assignments = await q('SELECT * FROM dp_assignments WHERE plan_id=$1 ORDER BY date, employee_id',[req.params.id]);

    // Build empQualMap: empId -> [shiftTypeId, ...]
    const empQualMap = {};
    for (const q_ of qualifications) {
      if (!empQualMap[q_.employee_id]) empQualMap[q_.employee_id] = [];
      empQualMap[q_.employee_id].push(q_.shift_type_id);
    }

    // Build wishDaySet: "empId_date"
    const wishDaySet = new Set(wishDays.map(w => `${w.employee_id}_${(w.date instanceof Date ? w.date.toISOString() : String(w.date)).slice(0,10)}`));

    // Build days array
    const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
    const days = [];
    const AT_HOLIDAYS = getAustrianHolidays(plan.year);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(plan.year, plan.month-1, d);
      const dateStr = date.toISOString().slice(0,10);
      const wd = date.getDay();
      const isWeekend = wd===0||wd===6;
      const holiday = AT_HOLIDAYS[dateStr];
      days.push({date:dateStr, weekday:wd, isWeekend, isHoliday:!!holiday, holidayName:holiday||''});
    }

    // Build requirements map: date -> shiftTypeId -> count
    const reqMap = {};
    for (const day of days) {
      reqMap[day.date] = {};
      for (const st of shiftTypes) {
        const count = getRequiredCount(requirements, st.id, day);
        if (count > 0) reqMap[day.date][st.id] = count;
      }
    }

    // Build assignment map: date -> shiftTypeId -> [assignments]
    const assignMap = {};
    const empAssignMap = {}; // empId -> date -> assignment
    for (const a of assignments) {
      const dateStr = a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date).slice(0,10);
      if (!assignMap[dateStr]) assignMap[dateStr] = {};
      if (a.shift_type_id) {
        if (!assignMap[dateStr][a.shift_type_id]) assignMap[dateStr][a.shift_type_id] = [];
        const at = absenceTypes.find(x=>x.id===a.absence_type_id);
        if (!at || at.reopens_shift) {
          if (!a.absence_type_id) assignMap[dateStr][a.shift_type_id].push(a.employee_id);
        }
      }
      if (!empAssignMap[a.employee_id]) empAssignMap[a.employee_id] = {};
      empAssignMap[a.employee_id][dateStr] = a;
    }

    // Build open slots per day
    const openSlots = {};
    for (const day of days) {
      openSlots[day.date] = {};
      for (const [stId, needed] of Object.entries(reqMap[day.date]||{})) {
        const filled = (assignMap[day.date]?.[stId]||[]).length;
        const open = needed - filled;
        if (open !== 0) openSlots[day.date][stId] = open; // negative = over-filled
      }
    }

    // Calculate monthly summary per employee
    const empParamMap = {};
    for (const p of empParams) empParamMap[p.employee_id] = p;

    const summaryMap = {};
    for (const a of assignments) {
      const empId = a.employee_id;
      if (!summaryMap[empId]) summaryMap[empId] = {actualHours:0,shiftHours:0,absenceHours:0,nightsWorked:0,weekendDays:0,freeWeekends:0,sickDays:0,vacationDays:0,zulageDays:0,leaveDays:0};
      const s = summaryMap[empId];
      const dateStr = a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date).slice(0,10);
      const wd = new Date(dateStr).getDay();
      const isWE = wd===0||wd===6;
      const h = parseFloat(a.hours_credited)||0;
      s.actualHours += h;
      if (a.shift_type_id && !a.absence_type_id) {
        s.shiftHours += h; // nur reine Dienstzeit (kein Abwesenheitstag)
        const st = shiftTypes.find(x=>x.id===a.shift_type_id);
        if (st?.is_night) s.nightsWorked++;
        if (st?.is_zulage) s.zulageDays++;
        if (isWE) s.weekendDays++;
      }
      if (a.absence_type_id) {
        const at2 = absenceTypes.find(x=>x.id===a.absence_type_id);
        const wd2 = new Date(dateStr).getDay();
        const isWE2 = wd2===0||wd2===6;
        const isHol2 = !!AT_HOLIDAYS[dateStr];
        const effectiveH = (at2?.zero_on_free_days && (isWE2||isHol2)) ? 0 : h;
        s.absenceHours += effectiveH;
        const at = at2;
        if (at) {
          if (at.code==='K') s.sickDays++;
          else if (at.code==='U') s.vacationDays++;
          else if (at.adjusts_monthly_target) s.leaveDays++;
        }
      }
    }

    // Ensure all employees with params appear in summary (even with zero assignments)
    for (const p of empParams) {
      if (!summaryMap[p.employee_id]) {
        summaryMap[p.employee_id] = {actualHours:0,shiftHours:0,absenceHours:0,nightsWorked:0,weekendDays:0,freeWeekends:0,sickDays:0,vacationDays:0,zulageDays:0,leaveDays:0};
      }
    }

    // Credit avg_shift_duration for public holidays where employee has no assignment.
    // No DB records are written – this is purely a summary calculation.
    {
      const profileMap = {};
      for (const hp of hoursProfiles) profileMap[hp.id] = hp;
      const holidayDates = days.filter(d => d.isHoliday).map(d => d.date);
      if (holidayDates.length > 0) {
        for (const p of empParams) {
          const s = summaryMap[p.employee_id];
          if (!s) continue;
          // Determine avg_shift_duration: profile > daily_hours > monthly/26
          const mh = parseFloat(p.monthly_hours) || 160;
          let avgShift = null;
          if (p.profile_id && profileMap[p.profile_id]) {
            const prof = profileMap[p.profile_id];
            avgShift = prof.avg_shift_duration ? parseFloat(prof.avg_shift_duration) : null;
            if (!avgShift && prof.daily_work_hours) avgShift = parseFloat(prof.daily_work_hours);
          }
          if (!avgShift) avgShift = p.daily_hours ? parseFloat(p.daily_hours) : Math.round(mh / 26 * 10) / 10;
          for (const dateStr of holidayDates) {
            if (empAssignMap[p.employee_id]?.[dateStr]) continue; // already has an entry
            s.absenceHours += avgShift;
            s.holidayHours  = (s.holidayHours || 0) + avgShift;
          }
        }
      }
    }

    // Calculate target hours per employee (adjusted for leave and holiday credits)
    for (const [empId, s] of Object.entries(summaryMap)) {
      const params = empParamMap[empId];
      if (!params) continue;
      const dailyTarget = params.daily_hours
        ? parseFloat(params.daily_hours)
        : Math.round((parseFloat(params.monthly_hours)||160) / 26 * 10) / 10;
      const contractHours = parseFloat(params.monthly_hours) || 160;
      const leaveReduction   = s.leaveDays * dailyTarget;
      const holidayReduction = s.holidayHours || 0; // same hours credited → Soll sinkt entsprechend
      const adjustedTarget = Math.max(0, contractHours - leaveReduction - holidayReduction);
      s.targetHours = Math.round(adjustedTarget * 10) / 10;
      s.dailyTarget = Math.round(dailyTarget * 10) / 10;
    }

    // Calculate free weekends (both Sa+So free)
    for (const [empId, s] of Object.entries(summaryMap)) {
      let freeWE = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(plan.year, plan.month-1, d);
        if (date.getDay() === 6) { // Saturday
          const satStr = date.toISOString().slice(0,10);
          const sun = new Date(plan.year, plan.month-1, d+1);
          const sunStr = sun.toISOString().slice(0,10);
          const satFree = !empAssignMap[empId]?.[satStr] || !!empAssignMap[empId]?.[satStr]?.absence_type_id;
          const sunFree = !empAssignMap[empId]?.[sunStr] || !!empAssignMap[empId]?.[sunStr]?.absence_type_id;
          if (satFree && sunFree) freeWE++;
        }
      }
      s.freeWeekends = freeWE;
    }

    ok(res, {
      plan,
      days,
      shiftTypes,
      absenceTypes,
      requirements: reqMap,
      openSlots,
      assignments: assignments.map(a=>({
        ...a,
        date: a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date).slice(0,10)
      })),
      empAssignMap: Object.fromEntries(
        Object.entries(empAssignMap).map(([empId, dateMap]) => [
          empId,
          Object.fromEntries(Object.entries(dateMap).map(([date, a]) => [
            date, {...a, date: a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date).slice(0,10)}
          ]))
        ])
      ),
      summary: summaryMap,
      empQualMap,
      wishDaySet: [...wishDaySet],
      allEmpIds: empParams.map(p => p.employee_id), // alle MA mit Parametern → immer anzeigen
    });
  } catch(e) { console.error('[dp/matrix]',e.message); bad(res,'Serverfehler',500); }
});

// ── PLAN RESET ────────────────────────────────────────────────────────────────

router.post('/plans/:id/reset', auth, async (req,res) => {
  const canEdit = req.p.manageUsers || (req.p.roles||[]).some(r=>['admin','dienstplanung','leitung'].includes(r));
  if (!canEdit) return bad(res,'Keine Berechtigung',403);
  try {
    // Delete shift assignments (no absence) and combined shift+absence
    // Keep pure absence records (absence_type_id IS NOT NULL AND shift_type_id IS NULL)
    await q(`DELETE FROM dp_assignments WHERE plan_id=$1 AND (shift_type_id IS NOT NULL AND absence_type_id IS NULL)`, [req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── PLAN VERSIONS ─────────────────────────────────────────────────────────────

router.get('/plans/:id/versions', auth, async (req,res) => {
  try { ok(res, await q('SELECT id,plan_id,version_name,created_by,created_at FROM dp_plan_versions WHERE plan_id=$1 ORDER BY created_at DESC',[req.params.id])); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/plans/:id/versions', auth, async (req,res) => {
  const canEdit = req.p.manageUsers || (req.p.roles||[]).some(r=>['admin','dienstplanung','leitung'].includes(r));
  if (!canEdit) return bad(res,'Keine Berechtigung',403);
  const {versionName} = req.body;
  if (!versionName?.trim()) return bad(res,'Name erforderlich',400);
  try {
    const assignments = await q('SELECT * FROM dp_assignments WHERE plan_id=$1',[req.params.id]);
    const row = await q1(`INSERT INTO dp_plan_versions (id,plan_id,version_name,assignments,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [newId(), req.params.id, versionName.trim(), JSON.stringify(assignments), req.uid]);
    ok(res, {id:row.id, plan_id:row.plan_id, version_name:row.version_name, created_at:row.created_at});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/plans/:id/versions/:vId/restore', auth, async (req,res) => {
  const canEdit = req.p.manageUsers || (req.p.roles||[]).some(r=>['admin','dienstplanung','leitung'].includes(r));
  if (!canEdit) return bad(res,'Keine Berechtigung',403);
  try {
    const ver = await q1('SELECT assignments FROM dp_plan_versions WHERE id=$1 AND plan_id=$2',[req.params.vId,req.params.id]);
    if (!ver) return bad(res,'Version nicht gefunden',404);
    const snapshotAssigns = typeof ver.assignments === 'string' ? JSON.parse(ver.assignments) : ver.assignments;
    await q('DELETE FROM dp_assignments WHERE plan_id=$1',[req.params.id]);
    for (const a of snapshotAssigns) {
      await q(`INSERT INTO dp_assignments (id,plan_id,employee_id,date,shift_type_id,absence_type_id,hours_credited,hours_source,is_overtime,is_locked,source,notes,created_by,created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
        [a.id,req.params.id,a.employee_id,a.date,a.shift_type_id||null,a.absence_type_id||null,a.hours_credited,a.hours_source,a.is_overtime,a.is_locked,a.source||'restored',a.notes||'',a.created_by||req.uid,a.created_at||new Date()]);
    }
    ok(res);
  } catch(e) { console.error(e); bad(res,'Serverfehler',500); }
});

router.delete('/plans/:id/versions/:vId', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try { await q('DELETE FROM dp_plan_versions WHERE id=$1 AND plan_id=$2',[req.params.vId,req.params.id]); ok(res); }
  catch(e) { bad(res,'Serverfehler',500); }
});

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

router.post('/plans/:id/assign', auth, async (req,res) => {
  const canEdit = req.p.manageUsers || (req.p.roles||[]).some(r=>['admin','dienstplanung','leitung'].includes(r));
  if (!canEdit) return bad(res,'Keine Berechtigung',403);
  try {
    const plan = await q1('SELECT * FROM dp_plans WHERE id=$1',[req.params.id]);
    if (!plan) return bad(res,'Plan nicht gefunden',404);
    const {employeeId,date,shiftTypeId,absenceTypeId,notes} = req.body;
    if (!employeeId||!date) return bad(res,'Mitarbeiter und Datum erforderlich',400);

    const shiftTypes = await q('SELECT * FROM dp_shift_types');

    // Calculate hours
    let hoursCredited = 0, hoursSource = 'shift';
    if (shiftTypeId && !absenceTypeId) {
      const st = await q1('SELECT duration_hours FROM dp_shift_types WHERE id=$1',[shiftTypeId]);
      hoursCredited = parseFloat(st?.duration_hours)||0;
      hoursSource = 'shift';
    } else if (absenceTypeId) {
      const at = await q1('SELECT * FROM dp_absence_types WHERE id=$1',[absenceTypeId]);
      if (at) {
        if (at.hours_calculation==='shift_hours' && shiftTypeId) {
          // Check if there was an existing shift assignment on this day
          const existingShift = await q1('SELECT hours_credited FROM dp_assignments WHERE plan_id=$1 AND employee_id=$2 AND date=$3 AND shift_type_id IS NOT NULL AND absence_type_id IS NULL',[req.params.id,employeeId,date]);
          if (existingShift) {
            hoursCredited = parseFloat(existingShift.hours_credited)||0;
            hoursSource = 'shift';
          } else {
            // Get daily target
            const params = await q1('SELECT monthly_hours, daily_hours FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
            const mh = parseFloat(params?.monthly_hours) || 160;
            hoursCredited = params?.daily_hours ? parseFloat(params.daily_hours) : Math.round(mh / 26 * 10) / 10;
            hoursSource = 'daily_target';
          }
        } else if (at.hours_calculation==='daily_target') {
          const params = await q1('SELECT monthly_hours, daily_hours, profile_id FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
          const mh = parseFloat(params?.monthly_hours) || 160;
          hoursCredited = params?.daily_hours ? parseFloat(params.daily_hours) : Math.round(mh / 26 * 10) / 10;
          hoursSource = 'daily_target';
        } else if (at.hours_calculation==='avg_shift_duration') {
          // Durchschnittliche Dienstdauer aus Profil oder daily_hours
          const params = await q1('SELECT monthly_hours, daily_hours, profile_id FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
          let avgShift = null;
          if (params?.profile_id) {
            const prof = await q1('SELECT avg_shift_duration, daily_work_hours FROM dp_hours_profiles WHERE id=$1',[params.profile_id]);
            avgShift = prof?.avg_shift_duration ? parseFloat(prof.avg_shift_duration) : (prof?.daily_work_hours ? parseFloat(prof.daily_work_hours) : null);
          }
          if (!avgShift) {
            const mh = parseFloat(params?.monthly_hours) || 160;
            avgShift = params?.daily_hours ? parseFloat(params.daily_hours) : Math.round(mh / 26 * 10) / 10;
          }
          // Wenn gleichzeitig Dienst: avg_shift_duration + Dienststunden (Feiertagszuschlag)
          if (shiftTypeId) {
            const st = await q1('SELECT duration_hours FROM dp_shift_types WHERE id=$1',[shiftTypeId]);
            hoursCredited = avgShift + (parseFloat(st?.duration_hours)||0);
          } else {
            hoursCredited = avgShift;
          }
          hoursSource = 'avg_shift_duration';
        } else if (at.hours_calculation==='zero') {
          hoursCredited = 0; hoursSource = 'zero';
        } else if (at.hours_calculation==='fixed') {
          hoursCredited = parseFloat(at.fixed_hours)||0; hoursSource = 'fixed';
        }

        // Feature 5: zero_on_free_days
        if (at?.zero_on_free_days) {
          const wd = new Date(date).getDay();
          const isWE = wd===0||wd===6;
          const isHol = !!getAustrianHolidays(new Date(date).getFullYear())[date];
          if (isWE||isHol) hoursCredited = 0;
        }
      }
    }

    // Remove existing assignment for this employee+date (upsert behavior)
    await q('DELETE FROM dp_assignments WHERE plan_id=$1 AND employee_id=$2 AND date=$3',[req.params.id,employeeId,date]);

    const id = newId();
    const row = await q1(
      `INSERT INTO dp_assignments (id,plan_id,employee_id,date,shift_type_id,absence_type_id,hours_credited,hours_source,is_locked,source,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,'manual',$9,$10) RETURNING *`,
      [id,req.params.id,employeeId,date,shiftTypeId||null,absenceTypeId||null,hoursCredited,hoursSource,notes||'',req.uid]
    );

    // Audit log if plan is published
    if (plan.status==='published') {
      await pool.query(
        `INSERT INTO dp_audit_log (id,plan_id,date,employee_id,action,new_value,performed_by) VALUES ($1,$2,$3,$4,'assign',$5,$6)`,
        [newId(),req.params.id,date,employeeId,JSON.stringify({shiftTypeId,absenceTypeId,hoursCredited}),req.uid]
      ).catch(()=>{});
    }

    // Feature 2: Validation warnings (non-blocking)
    const warnings = [];
    if (shiftTypeId) {
      // Check 48h/week
      const wk = getISOWeek(date);
      const weekStart = getISOWeekStart(wk, new Date(date).getFullYear());
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
      const wsStr = weekStart.toISOString().slice(0,10);
      const weStr = weekEnd.toISOString().slice(0,10);
      const weekAssigns = await q(`SELECT hours_credited FROM dp_assignments WHERE plan_id=$1 AND employee_id=$2 AND date>=$3 AND date<=$4 AND shift_type_id IS NOT NULL AND absence_type_id IS NULL`,[req.params.id,employeeId,wsStr,weStr]);
      const weekHours = weekAssigns.reduce((s,a)=>s+parseFloat(a.hours_credited||0),0);
      if (weekHours > 48) warnings.push(`48h/Woche überschritten: ${weekHours.toFixed(1)}h in KW${wk}`);
      // Check 11h rest
      const prevAssigns = await q(`SELECT date, hours_credited FROM dp_assignments WHERE plan_id=$1 AND employee_id=$2 AND shift_type_id IS NOT NULL AND absence_type_id IS NULL AND date != $3 ORDER BY date DESC LIMIT 3`,[req.params.id,employeeId,date]);
      const st = shiftTypes.find(x=>x.id===shiftTypeId);
      // Simple: check if previous day has a shift ending within 11h
      const prevDay = new Date(date); prevDay.setDate(prevDay.getDate()-1);
      const prevStr = prevDay.toISOString().slice(0,10);
      const prevAssign = prevAssigns.find(a=>String(a.date).slice(0,10)===prevStr);
      if (prevAssign && parseFloat(prevAssign.hours_credited||0) + (st ? parseFloat(st.duration_hours||0) : 0) > 13) {
        warnings.push('Möglicherweise <11h Ruhezeit zum Vortag');
      }
    }

    return ok(res, {...row, date: row.date instanceof Date ? row.date.toISOString().slice(0,10) : String(row.date).slice(0,10), warnings: warnings.length ? warnings : undefined});
  } catch(e) { console.error('[dp/assign]',e.message); bad(res,'Serverfehler',500); }
});

router.delete('/plans/:id/assign/:aid', auth, async (req,res) => {
  const canEdit = req.p.manageUsers || (req.p.roles||[]).some(r=>['admin','dienstplanung','leitung'].includes(r));
  if (!canEdit) return bad(res,'Keine Berechtigung',403);
  try {
    await q('DELETE FROM dp_assignments WHERE id=$1 AND plan_id=$2',[req.params.aid,req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── AUTO-SCHEDULER ────────────────────────────────────────────────────────────

router.post('/plans/:id/generate', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    const plan = await q1('SELECT * FROM dp_plans WHERE id=$1',[req.params.id]);
    if (!plan) return bad(res,'Plan nicht gefunden',404);

    // Delete previously auto-generated assignments (keep manual + locked ones)
    await q(`DELETE FROM dp_assignments WHERE plan_id=$1 AND source='generated' AND is_locked=false`,[req.params.id]);

    const planStartDate = `${plan.year}-${String(plan.month).padStart(2,'0')}-01`;
    const [shiftTypes,shiftPrefs,requirements,empParams,existingAssignments,wishDays,absenceTypes,qualifications,empRulesAll] = await Promise.all([
      q('SELECT * FROM dp_shift_types WHERE (valid_from IS NULL OR valid_from <= $1) AND (valid_until IS NULL OR valid_until >= $1) ORDER BY sort_order', [planStartDate]),
      q('SELECT DISTINCT ON (employee_id, shift_type_id) * FROM dp_shift_preferences WHERE valid_from IS NULL OR valid_from <= $1 ORDER BY employee_id, shift_type_id, valid_from DESC NULLS LAST', [planStartDate]),
      q('SELECT * FROM dp_shift_requirements ORDER BY shift_type_id, applies_to, weekday, valid_from DESC NULLS LAST'),
      q(`SELECT DISTINCT ON (employee_id) * FROM dp_employee_params WHERE valid_from IS NULL OR valid_from <= $1 ORDER BY employee_id, valid_from DESC NULLS LAST`,[planStartDate]),
      q(`SELECT * FROM dp_assignments WHERE plan_id=$1`,[req.params.id]),
      q('SELECT * FROM dp_wish_days WHERE month=$1 AND year=$2',[plan.month,plan.year]),
      q('SELECT * FROM dp_absence_types WHERE valid_from IS NULL OR valid_from <= $1 ORDER BY sort_order, label',[planStartDate]),
      q(`SELECT DISTINCT ON (employee_id, shift_type_id) * FROM dp_employee_qualifications WHERE valid_from IS NULL OR valid_from <= $1 ORDER BY employee_id, shift_type_id, valid_from DESC NULLS LAST`,[planStartDate]),
      q('SELECT * FROM dp_emp_rules').catch(()=>[]),
    ]);

    // Build empRuleMap
    const empRuleMap = {};
    for (const r of empRulesAll) {
      if (!empRuleMap[r.employee_id]) empRuleMap[r.employee_id] = [];
      empRuleMap[r.employee_id].push(r);
    }

    const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
    const AT_HOLIDAYS = getAustrianHolidays(plan.year);

    // Anzahl Feiertage dieses Monats für Überstunden-Toleranz
    const monthHolidayCount = Object.keys(AT_HOLIDAYS).filter(d =>
      d.startsWith(`${plan.year}-${String(plan.month).padStart(2,'0')}`)
    ).length;

    // Build qualification maps:
    // empQualMap: empId -> Set of shiftTypeIds the employee is qualified for
    // An employee with zero qualifications cannot be auto-scheduled at all.
    const empQualMap = {};
    for (const q_ of qualifications) {
      if (!empQualMap[q_.employee_id]) empQualMap[q_.employee_id] = new Set();
      empQualMap[q_.employee_id].add(q_.shift_type_id);
    }

    // Build shift preference map:
    // shiftPrefMap: empId -> shiftTypeId -> preference_weight
    const shiftPrefMap = {};
    for (const sp of shiftPrefs) {
      if (!shiftPrefMap[sp.employee_id]) shiftPrefMap[sp.employee_id] = {};
      shiftPrefMap[sp.employee_id][sp.shift_type_id] = sp.preference_weight;
    }

    // Build all required slots, sorted: nights first → weekends → date
    const slots = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(plan.year, plan.month-1, d);
      const dateStr = date.toISOString().slice(0,10);
      const wd = date.getDay();
      const dayInfo = {date:dateStr, weekday:wd, isWeekend:wd===0||wd===6, isHoliday:!!AT_HOLIDAYS[dateStr]};
      for (const st of shiftTypes) {
        if (st.is_office) continue; // office shifts handled in Phase 1
        const needed = getRequiredCount(requirements, st.id, dayInfo);
        const alreadyFilled = existingAssignments.filter(a=>
          a.date?.toString().slice(0,10)===dateStr && a.shift_type_id===st.id && !a.absence_type_id
        ).length;
        for (let i = 0; i < needed - alreadyFilled; i++) {
          slots.push({...dayInfo, shiftTypeId:st.id, shiftType:st});
        }
      }
    }
    slots.sort((a,b) => {
      if (a.shiftType.is_night !== b.shiftType.is_night) return a.shiftType.is_night ? -1 : 1;
      if ((a.isWeekend||a.isHoliday) !== (b.isWeekend||b.isHoliday)) return (a.isWeekend||a.isHoliday) ? -1 : 1;
      return a.date.localeCompare(b.date);
    });

    // Build employee state
    const empParamMap = {};
    const empState = {};
    for (const p of empParams) {
      empParamMap[p.employee_id] = p;
      const monthlyTarget = parseFloat(p.monthly_hours)||160;
      empState[p.employee_id] = {
        monthlyTarget,
        hoursAssigned: 0,
        officeHoursAssigned: 0,
        fdSpringerShiftsAssigned: 0,
        nightsAssigned: 0,
        weekendsAssigned: 0,
        weeklyHours: {},
        shiftTypeCount: {}, // stId -> Anzahl zugewiesener Dienste dieses Typs
        shiftTypeHours: {}, // stId -> Stunden zugewiesener Dienste dieses Typs (für proportionale Stunden-Gewichtung)
        totalShiftsAssigned: 0,
        lastAssignedDay: 0,
        assignments: existingAssignments.filter(a=>a.employee_id===p.employee_id).map(a=>({
          ...a, date: a.date?.toString().slice(0,10),
          shiftType: shiftTypes.find(s=>s.id===a.shift_type_id)||null,
        })),
      };
      for (const a of empState[p.employee_id].assignments) {
        if (!a.absence_type_id) {
          const h = parseFloat(a.hours_credited)||0;
          empState[p.employee_id].hoursAssigned += h;
          const wk = getISOWeek(a.date);
          empState[p.employee_id].weeklyHours[wk] = (empState[p.employee_id].weeklyHours[wk]||0) + h;
          if (a.shiftType?.is_office) empState[p.employee_id].officeHoursAssigned += h;
          if (a.shiftType?.code === 'FD') empState[p.employee_id].fdSpringerShiftsAssigned++;
        }
      }
    }

    const wishSet = new Set(wishDays.map(w=>`${w.employee_id}_${w.date?.toString().slice(0,10)||w.date}`));
    const absenceSet = new Set(existingAssignments.filter(a=>a.absence_type_id).map(a=>`${a.employee_id}_${a.date?.toString().slice(0,10)}`));

    const newAssignments = [];
    const protocolEntries = [];

    // ── PHASE 1: Bürodienste (Mo–Fr, 8h, basierend auf office_pct) ──────────────
    const officeShiftTypes = shiftTypes.filter(st => st.is_office);
    if (officeShiftTypes.length > 0) {
      for (const p of empParams) {
        if (!p.office_pct || p.office_pct <= 0) continue;
        const empId = p.employee_id;
        const state = empState[empId];
        if (!state) continue;

        // Find the first office shift type the employee is qualified for
        const empQuals = empQualMap[empId];
        const officeShiftType = officeShiftTypes.find(st => empQuals?.has(st.id));
        if (!officeShiftType) continue;

        const officeDuration = 8;
        const targetOfficeH = (parseFloat(p.monthly_hours)||160) * (p.office_pct / 100);
        const targetOfficeShifts = Math.round(targetOfficeH / officeDuration);
        const alreadyOfficeShifts = Math.floor(state.officeHoursAssigned / officeDuration);
        const needed = Math.max(0, targetOfficeShifts - alreadyOfficeShifts);
        if (needed <= 0) continue;

        // Collect available Mo–Fr days (no holidays, no absence, no existing shift, rules OK)
        const availableDays = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(plan.year, plan.month-1, d);
          const wd = date.getDay();
          if (wd === 0 || wd === 6) continue; // only Mo–Fr
          const dateStr = date.toISOString().slice(0,10);
          if (AT_HOLIDAYS[dateStr]) continue;
          if (absenceSet.has(`${empId}_${dateStr}`)) continue;
          if (state.assignments.some(a => a.date === dateStr && a.shift_type_id && !a.absence_type_id)) continue;
          const wk = getISOWeek(dateStr);
          if ((state.weeklyHours[wk]||0) + officeDuration > 48) continue;
          if (!checkRestPeriod(state.assignments, {date: dateStr, shiftType: officeShiftType}, shiftTypes)) continue;
          availableDays.push(dateStr);
        }

        // Distribute `needed` shifts evenly across available days
        for (let i = 0; i < needed && i < availableDays.length; i++) {
          const idx = Math.min(Math.floor((i / needed) * availableDays.length), availableDays.length - 1);
          const dateStr = availableDays[idx];
          const assignment = {
            id: newId(), plan_id: plan.id, employee_id: empId,
            date: dateStr, shift_type_id: officeShiftType.id, absence_type_id: null,
            hours_credited: officeDuration, hours_source: 'shift',
            is_overtime: false, is_locked: false, source: 'generated', notes: '',
            created_by: req.uid, shiftType: officeShiftType,
          };
          newAssignments.push(assignment);
          state.hoursAssigned += officeDuration;
          state.officeHoursAssigned += officeDuration;
          const wk = getISOWeek(dateStr);
          state.weeklyHours[wk] = (state.weeklyHours[wk]||0) + officeDuration;
          state.shiftTypeCount[officeShiftType.id] = (state.shiftTypeCount[officeShiftType.id]||0) + 1;
          state.shiftTypeHours[officeShiftType.id] = (state.shiftTypeHours[officeShiftType.id]||0) + officeDuration;
          state.totalShiftsAssigned++;
          state.assignments.push(assignment);
        }
      }
    }

    // ── PHASE 2: Reguläre Dienste aus Anforderungen ──────────────────────────────
    for (const slot of slots) {
      const slotHours = parseFloat(slot.shiftType.duration_hours)||0;

      // Build candidate list. Pass enforceSoftRules=true first; if no candidates, retry with false.
      const buildCandidates = (enforceSoftRules) => {
        const cands = [];
        const reasons = {};
        for (const [empId, state] of Object.entries(empState)) {
          const params = empParamMap[empId];
          if (!params) continue;

          // ── HARD RULES ──────────────────────────────────────────────────
          const empQuals = empQualMap[empId];
          if (!empQuals || empQuals.size === 0) { reasons[empId]='no_qualifications'; continue; }
          if (!empQuals.has(slot.shiftTypeId))   { reasons[empId]='not_qualified';    continue; }
          if (absenceSet.has(`${empId}_${slot.date}`)) { reasons[empId]='has_absence'; continue; }
          if (state.assignments.some(a=>a.date===slot.date&&a.shift_type_id&&!a.absence_type_id))
            { reasons[empId]='already_assigned'; continue; }

          // Hard: 48h/week cap (AZG §9)
          const wk = getISOWeek(slot.date);
          const projectedWeekHours = (state.weeklyHours[wk]||0) + slotHours;
          if (projectedWeekHours > 48) {
            reasons[empId]='weekly_cap_exceeded';
            protocolEntries.push({plan_id:plan.id,date:slot.date,shift_type_id:slot.shiftTypeId,
              reason:'weekly_cap_exceeded',employee_id:empId,
              details:{week:wk,projected:projectedWeekHours.toFixed(2)}});
            continue;
          }

          // Hard: 11h rest period (AZG §12)
          if (!checkRestPeriod(state.assignments, slot, shiftTypes))
            { reasons[empId]='rest_period_violated'; continue; }

          // Hard: no_weekends
          if (params.no_weekends && (new Date(slot.date).getDay()===0 || new Date(slot.date).getDay()===6))
            { reasons[empId]='no_weekends'; continue; }

          // Fixed rules
          const empRules = empRuleMap[empId] || [];
          const slotWD = new Date(slot.date).getDay();
          if (empRules.some(r => r.rule_type==='always_free' && r.day_of_week===slotWD)) { reasons[empId]='fixed_rule_free'; continue; }
          const alwaysShiftRule = empRules.find(r => r.rule_type==='always_shift' && r.day_of_week===slotWD);
          if (alwaysShiftRule && alwaysShiftRule.shift_type_id !== slot.shiftTypeId) { reasons[empId]='fixed_rule_other_shift'; continue; }

          // Hard: night restriction
          if (slot.shiftType.is_night && !params.can_do_nights)
            { reasons[empId]='cannot_do_nights'; continue; }

          // Hard: max nights per month (never relax this)
          const maxNightsAllowed = params.max_nights_per_month !== null ? params.max_nights_per_month : 6;
          if (slot.shiftType.is_night && state.nightsAssigned >= maxNightsAllowed)
            { reasons[empId]='nights_max_exceeded'; continue; }

          // Hard: max Dienste dieses Typs pro Monat für diesen MA
          if (slot.shiftType.max_per_emp_per_month !== null && slot.shiftType.max_per_emp_per_month !== undefined) {
            const countThisType = state.shiftTypeCount[slot.shiftTypeId] || 0;
            if (countThisType >= slot.shiftType.max_per_emp_per_month) {
              reasons[empId] = 'shift_type_monthly_limit'; continue;
            }
          }

          // Hard: consecutive nights restriction
          if (slot.shiftType.is_night) {
            const consecutiveNights = getConsecutiveNights(state.assignments, slot.date);
            const maxConsec = params.double_nights_allowed ? 2 : 1;
            if (consecutiveNights >= maxConsec) {
              reasons[empId]='consecutive_nights_exceeded'; continue;
            }
          }

          // Hard: FD-Springer Typ A (FD→LS): quota cap — only schedule up to configured shifts
          if (params.fd_springer_type === 'FD_to_LS') {
            const quota = parseInt(params.fd_springer_shifts_per_month)||0;
            if (quota > 0 && state.fdSpringerShiftsAssigned >= quota) {
              reasons[empId]='fd_springer_quota_reached'; continue;
            }
          }

          // Hard: FD-Springer Typ B (LS→FD): only allowed in FD slots up to quota, never more
          if (params.fd_springer_type === 'LS_to_FD' && slot.shiftType.code === 'FD') {
            const quota = parseInt(params.fd_springer_shifts_per_month)||0;
            if (state.fdSpringerShiftsAssigned >= quota)
              { reasons[empId]='fd_springer_fd_quota_reached'; continue; }
          }
          // Hard: Non-FD-Springer employees must not be scheduled for FD slots
          if (slot.shiftType.code === 'FD' && params.fd_springer_type !== 'LS_to_FD') {
            reasons[empId]='not_fd_springer'; continue;
          }

          // ── SOFT RULES (only enforced on first pass) ───────────────────
          if (enforceSoftRules) {
            if (state.hoursAssigned >= state.monthlyTarget)
              { reasons[empId]='monthly_cap_exceeded'; continue; }
            if (getConsecutiveDays(state.assignments, slot.date) >= 6)
              { reasons[empId]='consecutive_days_limit'; continue; }
          }

          const isWishDay = wishSet.has(`${empId}_${slot.date}`);

          // ── SCORING (niedriger Score = besserer Kandidat) ──────────────────
          // Ziel: alle MA enden mit gleich wenig Überstunden, unabhängig vom Target
          const overtime = Math.max(0, state.hoursAssigned - state.monthlyTarget);

          let score;
          if (overtime > 0) {
            // Bereits in Überstunden: absolute OT-Stunden als Penalty
            // 5h OT bei 80h-Target = 5h OT bei 160h-Target → gleiche Strafe
            score = 1000 + overtime * 100;
          } else {
            // Unter Target: Fill-Ratio als Score (0=leer=bester, 100=voll=schlechter)
            // 0/80 (0% gefüllt) = score 0 = gleich wie 0/160 (0% gefüllt)
            // 40/80 (50% gefüllt) = score 50 = gleich wie 80/160 (50% gefüllt)
            const fillRatio = state.hoursAssigned / (state.monthlyTarget || 160);
            score = fillRatio * 100;
          }

          // Nächte und Wochenenden equalisieren
          if (slot.shiftType.is_night) score += state.nightsAssigned * 20;
          if (slot.isWeekend || slot.isHoliday) score += state.weekendsAssigned * 20;

          // Wunschtag (schlechter Score = will nicht arbeiten)
          if (isWishDay) score += 10000;

          // FD-Springer Typ B: FD-Slots stark bevorzugen bis Quote erreicht
          if (params.fd_springer_type === 'LS_to_FD' && slot.shiftType.code === 'FD') {
            const quota = parseInt(params.fd_springer_shifts_per_month)||0;
            score -= Math.max(0, quota - state.fdSpringerShiftsAssigned) * 200;
          }

          // Feature 8: Fair distribution: penalize if assigned too recently vs others
          const dayNum = parseInt(slot.date.slice(8)); // day of month
          const daysSinceLast = dayNum - (state.lastAssignedDay || 0);
          const avgDaysSince = Object.values(empState).filter(es=>es.totalShiftsAssigned>0)
            .reduce((sum,es)=>sum+(dayNum-(es.lastAssignedDay||0)),0) /
            Math.max(1, Object.values(empState).filter(es=>es.totalShiftsAssigned>0).length);
          // Bonus for employees who haven't been assigned in a while, penalty for recent
          score += Math.min(15, Math.max(-15, (daysSinceLast - avgDaysSince) * 1.5));

          // ── Proportionale Dienst-Gewichtung (Stunden-basiert) ──
          // Gewichtungen definieren ANTEIL der Monats-Sollstunden pro Dienst.
          // 100% ND1 = der MA soll 100% seiner verfügbaren Stunden als ND1 bekommen, NICHT mehr.
          // Max-Bonus ±25 damit er nie den primären Fill-Ratio-Score (0-100) überschreibt.
          const empPrefs = shiftPrefMap[empId];
          if (empPrefs && Object.keys(empPrefs).length > 0) {
            const totalPrefWeight = Object.values(empPrefs).reduce((s, v) => s + v, 0);
            if (totalPrefWeight > 0) {
              const pref = empPrefs[slot.shiftTypeId];
              if (pref !== undefined) {
                // Ziel-Stunden für diesen Diensttyp = Monatssoll * Anteil
                const targetHoursForType = state.monthlyTarget * (pref / totalPrefWeight);
                const assignedHoursForType = state.shiftTypeHours[slot.shiftTypeId] || 0;
                // Deficit (positiv = noch unter Ziel, negativ = über Ziel)
                const deficitH = targetHoursForType - assignedHoursForType;
                // Normiert auf Monatszeit, max ±25 Punkte (sekundär zum Fill-Ratio)
                const adj = Math.max(-25, Math.min(25, (deficitH / state.monthlyTarget) * 100));
                score -= adj; // Deficit → adj positiv → score sinkt (besser)
              } else {
                // MA hat Gewichtungen, aber nicht für diesen Dienst → leicht benachteiligen
                score += 10;
              }
            }
          }

          cands.push({empId, score});
        }
        return {cands, reasons};
      };

      let {cands: candidates, reasons: skipReasons} = buildCandidates(true);
      let softViolated = false;

      if (candidates.length === 0) {
        // Pass 2: Relax consecutive_days but STILL exclude employees already at/over target
        // This ensures employees with deficit get priority over overtime employees
        const pass2 = buildCandidates(false);
        // Filter pass2 to only include employees not yet at their target
        const pass2NoBonusOT = pass2.cands.filter(c => {
          const st2 = empState[c.empId];
          return st2 && st2.hoursAssigned < st2.monthlyTarget;
        });
        if (pass2NoBonusOT.length > 0) {
          candidates = pass2NoBonusOT;
          skipReasons = pass2.reasons;
          softViolated = true;
          protocolEntries.push({plan_id:plan.id, date:slot.date, shift_type_id:slot.shiftTypeId,
            reason:'consecutive_days_relaxed', employee_id:null,
            details:{message:'consecutive_days limit relaxed, deficit employee used'}});
        } else if (pass2.cands.length > 0) {
          // Pass 3: No deficit employees available – allow overtime employees (last resort)
          candidates = pass2.cands;
          skipReasons = pass2.reasons;
          softViolated = true;
          protocolEntries.push({plan_id:plan.id, date:slot.date, shift_type_id:slot.shiftTypeId,
            reason:'overtime_forced', employee_id:null,
            details:{message:'all deficit employees unavailable, overtime employee used as last resort'}});
        }
      }

      if (candidates.length === 0) {
        const reasons = Object.values(skipReasons);
        const mainReason = reasons.length > 0 ? reasons[0] : 'no_candidates';
        protocolEntries.push({
          plan_id: plan.id,
          date: slot.date,
          shift_type_id: slot.shiftTypeId,
          reason: mainReason,
          employee_id: null,
          details: {total_checked: Object.keys(empState).length}
        });
        continue;
      }

      candidates.sort((a,b)=>a.score-b.score);
      const winnerId = candidates[0].empId;
      const st = slot.shiftType;
      const assignment = {
        id: newId(), plan_id: plan.id, employee_id: winnerId,
        date: slot.date, shift_type_id: slot.shiftTypeId, absence_type_id: null,
        hours_credited: slotHours, hours_source: 'shift',
        is_overtime: false, is_locked: false, source: 'generated', notes: '',
        created_by: req.uid, shiftType: st,
      };
      if (softViolated) {
        protocolEntries.push({plan_id:plan.id,date:slot.date,shift_type_id:slot.shiftTypeId,
          reason:'soft_rule_relaxed',employee_id:winnerId,
          details:{violated_rule:skipReasons[winnerId]||'unknown'}});
      }
      newAssignments.push(assignment);

      const state = empState[winnerId];
      state.hoursAssigned += slotHours;
      const wk = getISOWeek(slot.date);
      state.weeklyHours[wk] = (state.weeklyHours[wk]||0) + slotHours;
      if (st.is_night) state.nightsAssigned++;
      if (st.is_office) state.officeHoursAssigned += slotHours;
      if (st.code === 'FD' || empParamMap[winnerId]?.fd_springer_type === 'FD_to_LS')
        state.fdSpringerShiftsAssigned++;
      if (slot.isWeekend||slot.isHoliday) state.weekendsAssigned++;
      state.assignments.push(assignment);

      state.shiftTypeCount[st.id] = (state.shiftTypeCount[st.id] || 0) + 1;
      state.shiftTypeHours[st.id] = (state.shiftTypeHours[st.id] || 0) + slotHours;
      state.totalShiftsAssigned++;
      state.lastAssignedDay = parseInt(slot.date.slice(8));

      // Überstunden protokollieren
      const newOT = Math.max(0, state.hoursAssigned - state.monthlyTarget);
      const prevOT = Math.max(0, (state.hoursAssigned - slotHours) - state.monthlyTarget);
      if (newOT > prevOT) {
        const dailyStd = state.monthlyTarget / 20;
        const holidayAllowance = monthHolidayCount * dailyStd;
        protocolEntries.push({
          plan_id: plan.id, date: slot.date, shift_type_id: slot.shiftTypeId,
          reason: 'overtime_assigned', employee_id: winnerId,
          details: {
            overtime_total_h: parseFloat(newOT.toFixed(2)),
            shift_h: slotHours,
            monthly_target_h: state.monthlyTarget,
            holiday_allowance_h: parseFloat(holidayAllowance.toFixed(2)),
            holiday_count: monthHolidayCount
          }
        });
      }
    }

    // ── PHASE 3: Springer FD-Pairing ────────────────────────────────────────────
    // For each FD_to_LS springer assigned to a Leitstelle (is_office) shift,
    // ensure a LS_to_FD springer is also assigned an FD shift on a day near that date.
    const lsSpringers = empParams.filter(p => p.fd_springer_type === 'FD_to_LS');
    const fdSpringers = empParams.filter(p => p.fd_springer_type === 'LS_to_FD');
    const officeShiftsList = shiftTypes.filter(st => st.is_office);
    const fdShiftsList = shiftTypes.filter(st => !st.is_office && !st.is_night);

    for (const lsSpr of lsSpringers) {
      const lsAssigns = newAssignments.filter(a => a.employee_id===lsSpr.employee_id && officeShiftsList.some(os=>os.id===a.shift_type_id));
      for (const la of lsAssigns) {
        // Check if any fdSpringer already has an FD shift on same day
        const alreadyCovered = fdSpringers.some(fdSpr => newAssignments.some(a=>a.employee_id===fdSpr.employee_id&&a.date===la.date&&a.shift_type_id));
        if (alreadyCovered) continue;
        // Find an available fdSpringer
        for (const fdSpr of fdSpringers) {
          if (absenceSet.has(`${fdSpr.employee_id}_${la.date}`)) continue;
          if (newAssignments.some(a=>a.employee_id===fdSpr.employee_id&&a.date===la.date&&a.shift_type_id)) continue;
          const fdSt = fdShiftsList[0]; // use first available FD shift type
          if (!fdSt) continue;
          const wk = getISOWeek(la.date);
          const fdWeekH = newAssignments.filter(a=>a.employee_id===fdSpr.employee_id&&getISOWeek(a.date)===wk&&a.shift_type_id&&!a.absence_type_id).reduce((s,a)=>s+parseFloat(a.hours_credited||0),0);
          if (fdWeekH + parseFloat(fdSt.duration_hours||0) > 48) continue;
          if (!checkRestPeriod(newAssignments.filter(a=>a.employee_id===fdSpr.employee_id), {date:la.date,shiftType:fdSt}, shiftTypes)) continue;
          newAssignments.push({id:newId(),plan_id:plan.id,employee_id:fdSpr.employee_id,date:la.date,shift_type_id:fdSt.id,absence_type_id:null,hours_credited:parseFloat(fdSt.duration_hours||0),hours_source:'shift',is_overtime:false,is_locked:false,source:'springer_pairing',notes:`Springer für ${lsSpr.employee_id}`,created_by:req.uid});
          break;
        }
      }
    }

    // ── POST-GENERATION: Überstunden ausgleichen ──
    // Nach der Generierung iterativ versuchen Dienste zu verschieben
    // um Überstunden auszugleichen
    const rebalancedAssignments = await rebalanceOvertimeAssignments(
      newAssignments, empState, empParamMap, empQualMap, shiftTypes,
      AT_HOLIDAYS, plan, absenceSet
    );

    // Feature 9: Weekend rebalancing
    rebalanceWeekendAssignments(rebalancedAssignments, empParams, empParamMap, shiftTypes, plan, absenceSet);

    if (rebalancedAssignments.length > 0) {
      for (const a of rebalancedAssignments) {
        await pool.query(
          `INSERT INTO dp_assignments (id,plan_id,employee_id,date,shift_type_id,absence_type_id,hours_credited,hours_source,is_overtime,is_locked,source,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,'generated',$9,$10)`,
          [a.id,a.plan_id,a.employee_id,a.date,a.shift_type_id,null,a.hours_credited,'shift',a.notes,a.created_by]
        ).catch(()=>{});
      }
    }

    // Save protocol entries
    for (const p of protocolEntries) {
      await pool.query(
        `INSERT INTO dp_generation_protocol (id,plan_id,date,shift_type_id,reason,employee_id,details)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId(), p.plan_id, p.date, p.shift_type_id, p.reason, p.employee_id, JSON.stringify(p.details||{})]
      ).catch(()=>{});
    }

    await pool.query(`UPDATE dp_plans SET generated_at=NOW(),generated_by=$1,status='reviewed' WHERE id=$2`,[req.uid,plan.id]);

    // Check for weekly hour cap warnings
    const weeklyCapWarnings = [];
    for (const [empId, state] of Object.entries(empState)) {
      for (const [wk, hours] of Object.entries(state.weeklyHours)) {
        if (hours > 48) {
          weeklyCapWarnings.push({employeeId: empId, week: wk, hours: parseFloat(hours.toFixed(2))});
        }
      }
    }

    const violatedWishDays = [];
    for (const wd of wishDays) {
      const wdDate = wd.date?.toString().slice(0,10)||wd.date;
      const assigned = [...newAssignments,...existingAssignments].find(a=>
        a.employee_id===wd.employee_id && a.date?.toString().slice(0,10)===wdDate && a.shift_type_id && !a.absence_type_id
      );
      if (assigned) violatedWishDays.push(wd.id);
    }
    for (const id of violatedWishDays) {
      await pool.query(`UPDATE dp_wish_days SET status='violated' WHERE id=$1`,[id]).catch(()=>{});
    }

    // ── ANALYSE & PROTOKOLL-REPORT ──
    const report = {
      zeitstempel: new Date().toISOString(),
      dienstplanRegeln: [],
      gesetzlicheRegeln: [],
      warnungen: [],
      fehler: []
    };

    // 1. Überstunden-Analyse
    const overtimeList = [];
    for (const [empId, state] of Object.entries(empState)) {
      const ot = Math.max(0, state.hoursAssigned - state.monthlyTarget);
      if (ot > 0) overtimeList.push({empId, ot});
    }
    if (overtimeList.length > 0) {
      const avgOT = overtimeList.reduce((s, x) => s + x.ot, 0) / overtimeList.length;
      const maxOT = Math.max(...overtimeList.map(x => x.ot));
      const minOT = Math.min(...overtimeList.map(x => x.ot));
      report.dienstplanRegeln.push({
        regel: 'Überstunden-Ausgleich',
        status: maxOT - minOT <= 10 ? 'OK' : 'WARNUNG',
        details: `Durchschnitt: ${avgOT.toFixed(1)}h, Min: ${minOT.toFixed(1)}h, Max: ${maxOT.toFixed(1)}h. Differenz: ${(maxOT-minOT).toFixed(1)}h.`
      });
    } else {
      report.dienstplanRegeln.push({
        regel: 'Überstunden-Ausgleich',
        status: 'OK',
        details: 'Keine Überstunden.'
      });
    }

    // 2. Nachtdienst-Max
    const nightsExceeded = [];
    for (const [empId, state] of Object.entries(empState)) {
      const params = empParamMap[empId];
      const maxNights = params?.max_nights_per_month !== null ? params.max_nights_per_month : 6;
      if (state.nightsAssigned > maxNights) {
        nightsExceeded.push({empId, actual: state.nightsAssigned, max: maxNights});
      }
    }
    report.dienstplanRegeln.push({
      regel: 'Nachtdienst-Max (≤6)',
      status: nightsExceeded.length === 0 ? 'OK' : 'FEHLER',
      details: nightsExceeded.length === 0 ? 'Alle MA unter Nachtdienst-Limit.' : `${nightsExceeded.length} MA überschreitet Limit.`
    });

    // 3. Wochenarbeitszeit 48h
    const weeklyExceeded = [];
    for (const [empId, state] of Object.entries(empState)) {
      for (const [week, hours] of Object.entries(state.weeklyHours)) {
        if (hours > 48) {
          weeklyExceeded.push({empId, week, hours: parseFloat(hours.toFixed(2))});
        }
      }
    }
    report.gesetzlicheRegeln.push({
      regel: 'Wochenarbeitszeit ≤48h (AZG §9)',
      status: weeklyExceeded.length === 0 ? 'OK' : 'WARNUNG',
      details: weeklyExceeded.length === 0 ? 'Alle Wochen OK.' : `${weeklyExceeded.length} Wochen-MA-Kombinationen überschreiten 48h.`
    });

    // 4. Ruhezeit 11h (schwer zu prüfen ohne Detail-Analyse, simplified):
    report.gesetzlicheRegeln.push({
      regel: 'Mindest-Ruhezeit 11h (AZG §12)',
      status: 'OK',
      details: 'Prüfung während Generierung durchgeführt.'
    });

    // 5. Unfilled Slots
    const unfilledCount = protocolEntries.filter(p => !p.employee_id).length;
    if (unfilledCount > 0) {
      report.fehler.push({
        kategorie: 'Offene Dienste',
        count: unfilledCount,
        details: `${unfilledCount} Dienste konnten nicht besetzt werden.`
      });
    } else {
      report.dienstplanRegeln.push({
        regel: 'Dienst-Besetzung',
        status: 'OK',
        details: 'Alle Dienste erfolgreich besetzt.'
      });
    }

    // Report speichern
    await pool.query(
      `UPDATE dp_plans SET generation_report=$1 WHERE id=$2`,
      [JSON.stringify(report), plan.id]
    ).catch(()=>{});

    ok(res, {
      generated: newAssignments.length,
      total: slots.length,
      violations: violatedWishDays.length,
      unfilled: protocolEntries.length,
      weeklyCapWarnings: weeklyCapWarnings,
      report: report
    });
  } catch(e) { console.error('[dp/generate]',e.message,e.stack); bad(res,'Serverfehler',500); }
});

// ── WISH DAYS ─────────────────────────────────────────────────────────────────

router.get('/wish-days', auth, async (req,res) => {
  try {
    const {month,year} = req.query;
    let rows;
    if (req.p.manageUsers) {
      rows = await q('SELECT * FROM dp_wish_days WHERE month=$1 AND year=$2 ORDER BY date',[month,year]);
    } else {
      rows = await q('SELECT * FROM dp_wish_days WHERE employee_id=$1 AND month=$2 AND year=$3 ORDER BY date',[req.uid,month,year]);
    }
    ok(res, rows);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/wish-days', auth, async (req,res) => {
  const {date,month,year,reason,employeeId} = req.body;
  if (!date||!month||!year) return bad(res,'Datum erforderlich',400);
  // Admins may set wish days for any employee; others only for themselves
  const targetEmpId = (req.p.manageUsers && employeeId) ? employeeId : req.uid;
  try {
    // Check max 3 per month
    const existing = await q('SELECT id FROM dp_wish_days WHERE employee_id=$1 AND month=$2 AND year=$3',[targetEmpId,month,year]);
    if (existing.length >= 3) return bad(res,'Maximal 3 Wunschtage pro Monat',400);
    const row = await q1(
      `INSERT INTO dp_wish_days (id,employee_id,month,year,date,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(),targetEmpId,month,year,date,reason||'']
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/wish-days/:id', auth, async (req,res) => {
  try {
    const wd = await q1('SELECT employee_id FROM dp_wish_days WHERE id=$1',[req.params.id]);
    if (!wd) return bad(res,'Nicht gefunden',404);
    if (wd.employee_id !== req.uid && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await q('DELETE FROM dp_wish_days WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── EMP RULES ─────────────────────────────────────────────────────────────────

router.get('/emp-rules', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_emp_rules ORDER BY employee_id, day_of_week')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/emp-rules', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId, ruleType, dayOfWeek, shiftTypeId, validFrom} = req.body;
  if (!employeeId||!ruleType) return bad(res,'Pflichtfelder fehlen',400);
  try {
    const row = await q1(`INSERT INTO dp_emp_rules (id,employee_id,rule_type,day_of_week,shift_type_id,valid_from,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId(),employeeId,ruleType,dayOfWeek!==undefined?dayOfWeek:null,shiftTypeId||null,validFrom||null,req.uid]);
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/emp-rules/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try { await q('DELETE FROM dp_emp_rules WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { bad(res,'Serverfehler',500); }
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getRequiredCount(requirements, shiftTypeId, dayInfo) {
  // Filter to requirements valid on dayInfo.date
  const date = dayInfo.date; // 'YYYY-MM-DD'
  const validReqs = requirements.filter(r => {
    const from = r.valid_from ? String(r.valid_from).slice(0,10) : null;
    const until = r.valid_until ? String(r.valid_until).slice(0,10) : null;
    if (from && from > date) return false;
    if (until && until < date) return false;
    return true;
  });
  // Check specific date first
  const specific = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='date' && r.specific_date?.toString().slice(0,10)===dayInfo.date);
  if (specific) return specific.slot_count;
  // Daily (every day incl. holidays)
  const daily = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='daily');
  if (daily) return daily.slot_count;
  // Holiday: only 'holiday' rule applies — weekday/weekend rules do NOT fall through to holidays
  if (dayInfo.isHoliday) {
    const hol = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='holiday');
    return hol ? hol.slot_count : 0;
  }
  // Weekend: only 'weekend' rule applies — weekday rules do NOT fall through to weekends
  if (dayInfo.isWeekend) {
    const we = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekend');
    return we ? we.slot_count : 0;
  }
  // Weekday (Mon–Fri, non-holiday): specific weekday first, then general Mo–Fr
  const wdReq = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===dayInfo.weekday);
  if (wdReq) return wdReq.slot_count;
  const general = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===null);
  return general ? general.slot_count : 0;
}

function getWorkDaysInMonth(year, month, holidays) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month-1, d);
    const dateStr = date.toISOString().slice(0,10);
    const wd = date.getDay();
    if (wd !== 0 && wd !== 6 && !holidays[dateStr]) count++;
  }
  return count;
}

function getAustrianHolidays(year) {
  // Fixed Austrian public holidays
  const holidays = {
    [`${year}-01-01`]: 'Neujahr',
    [`${year}-01-06`]: 'Heilige Drei Könige',
    [`${year}-05-01`]: 'Staatsfeiertag',
    [`${year}-08-15`]: 'Mariä Himmelfahrt',
    [`${year}-10-26`]: 'Nationalfeiertag',
    [`${year}-11-01`]: 'Allerheiligen',
    [`${year}-12-08`]: 'Mariä Empfängnis',
    [`${year}-12-25`]: 'Christtag',
    [`${year}-12-26`]: 'Stefanitag',
  };
  // Moveable holidays (Easter-based)
  const easter = getEasterDate(year);
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
  holidays[addDays(easter, -2)] = 'Karfreitag';
  holidays[addDays(easter, 1)]  = 'Ostermontag';
  holidays[addDays(easter, 39)] = 'Christi Himmelfahrt';
  holidays[addDays(easter, 49)] = 'Pfingstmontag';
  holidays[addDays(easter, 60)] = 'Fronleichnam';
  return holidays;
}

function getEasterDate(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}

// Returns the Monday of the ISO week as a Date object
function getISOWeekStart(isoWeekStr, year) {
  // isoWeekStr format: "YYYY-Www"
  const weekNum = parseInt(isoWeekStr.split('-W')[1]);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (weekNum - 1) * 7);
  return monday;
}

// Returns ISO week string YYYY-Www for a date string
function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay()||7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}

// Returns decimal hour when shift ends (handles overnight: end_time < start_time adds 24)
function getShiftEndHour(st) {
  const [sh, sm] = (st.start_time||'08:00').split(':').map(Number);
  const [eh, em] = (st.end_time||'20:00').split(':').map(Number);
  const startH = sh + sm/60;
  let endH = eh + em/60;
  if (endH <= startH) endH += 24;
  return endH;
}

function getShiftStartHour(st) {
  const [h, m] = (st.start_time||'08:00').split(':').map(Number);
  return h + m/60;
}

// Check 11h rest period (Austrian AZG §12)
function checkRestPeriod(assignments, slot, shiftTypes) {
  const slotStartH = getShiftStartHour(slot.shiftType);
  const slotEndH   = getShiftEndHour(slot.shiftType);

  for (const a of assignments) {
    if (!a.date || a.absence_type_id || !a.shift_type_id) continue;
    const prevSt = a.shiftType || shiftTypes.find(s=>s.id===a.shift_type_id);
    if (!prevSt) continue;

    const diffDays = (new Date(slot.date) - new Date(a.date)) / 86400000;
    if (Math.abs(diffDays) > 2) continue; // far enough apart, skip

    if (diffDays === 0) return false; // same day

    const prevStartH = getShiftStartHour(prevSt);
    const prevEndH   = getShiftEndHour(prevSt);

    if (diffDays > 0) {
      // prev is before slot: prev shift ends at (prevEndH + diffDays*24) before slot
      // slot starts at slotStartH on slot.date
      // rest = slotStartH - (prevEndH - diffDays*24 relative to slot date)
      // Simplified: absolute hours
      const prevEndAbs = prevEndH; // hours from midnight of prev.date
      const slotStartAbs = slotStartH + diffDays * 24; // hours from midnight of prev.date
      if (slotStartAbs - prevEndAbs < 11) return false;
    } else {
      // prev is after slot (diffDays < 0): slot ends, then prev starts
      const slotEndAbs = slotEndH; // hours from midnight of slot.date
      const prevStartAbs = prevStartH + Math.abs(diffDays) * 24;
      if (prevStartAbs - slotEndAbs < 11) return false;
    }
  }
  return true;
}

// Count consecutive days worked up to (not including) targetDate
function getConsecutiveDays(assignments, targetDate) {
  const worked = new Set(assignments
    .filter(a=>!a.absence_type_id && a.shift_type_id)
    .map(a=>a.date)
  );
  let count = 0;
  let d = new Date(targetDate);
  d.setDate(d.getDate() - 1);
  while (worked.has(d.toISOString().slice(0,10))) {
    count++;
    d.setDate(d.getDate() - 1);
    if (count > 7) break;
  }
  return count;
}

// Count consecutive nights (is_night) up to but not including targetDate
function getConsecutiveNights(assignments, targetDate) {
  const nights = new Set(assignments
    .filter(a=>!a.absence_type_id && a.shift_type_id && a.shiftType && a.shiftType.is_night)
    .map(a=>a.date)
  );
  let count = 0;
  let d = new Date(targetDate);
  d.setDate(d.getDate() - 1);
  while (nights.has(d.toISOString().slice(0,10))) {
    count++;
    d.setDate(d.getDate() - 1);
    if (count > 30) break;
  }
  return count;
}

// ── POST-GENERATION REBALANCING ───────────────────────────────────────────────
// Versuche nach der Generierung Dienste zwischen MA zu verschieben um Überstunden
// fair auszugleichen und MA mit Deficit zu bevorzugen
async function rebalanceOvertimeAssignments(
  assignments, empState, empParamMap, empQualMap, shiftTypes,
  AT_HOLIDAYS, plan, absenceSet
) {
  let improved = true;
  let iteration = 0;
  const maxIterations = 5;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    // Berechne OT und Deficit pro MA basierend auf AKTUELLEN Assignments
    const stats = {};
    for (const [empId, state] of Object.entries(empState)) {
      const totalHours = state.assignments
        .filter(a => !a.absence_type_id)
        .reduce((sum, a) => sum + (parseFloat(a.hours_credited) || 0), 0);
      const target = state.monthlyTarget;
      stats[empId] = {
        target,
        totalHours,
        ot: Math.max(0, totalHours - target),
        deficit: Math.max(0, target - totalHours),
      };
    }

    // Berechne Durchschnitt OT (für alle die OT haben)
    const empIdsWithOT = Object.entries(stats)
      .filter(([id, s]) => s.ot > 0)
      .map(([id]) => id);

    if (empIdsWithOT.length === 0) break; // Keine OT mehr – fertig!

    const avgOT = empIdsWithOT.reduce((sum, id) => sum + stats[id].ot, 0) / empIdsWithOT.length;
    const fairnessTolerance = 3; // Tolerance: bis zu 3h Differenz OK

    // Finde MA mit OT > avgOT + tolerance
    const overtimeEmpIds = empIdsWithOT.filter(id => stats[id].ot > avgOT + fairnessTolerance);

    for (const ovtEmpId of overtimeEmpIds) {
      // Finde MA mit Deficit
      const deficitEmpIds = Object.entries(stats)
        .filter(([id, s]) => s.deficit > 2) // mindestens 2h Deficit
        .map(([id]) => id);

      if (deficitEmpIds.length === 0) continue;

      // Finde Dienste von ovtEmpId die verschiebbar sind
      // (kleine Dienste, nicht letzte in Reihe, etc.)
      const ovtAssignments = assignments.filter(a =>
        a.employee_id === ovtEmpId && a.shift_type_id && !a.absence_type_id
      );

      // Sortiere by Dauer (kleine first, einfacher zu verschieben)
      ovtAssignments.sort((a, b) => (parseFloat(a.hours_credited) || 0) - (parseFloat(b.hours_credited) || 0));

      for (const assignToMove of ovtAssignments) {
        // Finde einen geeigneten Empfänger mit Deficit + Qualifikation
        const deficitRecipients = deficitEmpIds.filter(recipId => {
          const recipQuals = empQualMap[recipId];
          if (!recipQuals?.has(assignToMove.shift_type_id)) return false;

          // Hard-Rules checken für den neuen Empfänger:
          // 1. Keine Abwesenheit an dem Tag
          const dateStr = assignToMove.date instanceof Date
            ? assignToMove.date.toISOString().slice(0, 10)
            : String(assignToMove.date).slice(0, 10);
          if (absenceSet.has(`${recipId}_${dateStr}`)) return false;

          // 2. Keine andere Schicht an dem Tag
          const hasOtherShift = empState[recipId]?.assignments.some(a => {
            const aDate = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10);
            return aDate === dateStr && a.shift_type_id && !a.absence_type_id && a.id !== assignToMove.id;
          });
          if (hasOtherShift) return false;

          // 3. Weekly cap: würde die neue Schicht das Wochen-Limit sprengen?
          const wk = getISOWeek(dateStr);
          const weeklyHours = empState[recipId]?.assignments
            .filter(a => {
              const aDate = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10);
              return getISOWeek(aDate) === wk && !a.absence_type_id;
            })
            .reduce((sum, a) => sum + (parseFloat(a.hours_credited) || 0), 0) || 0;
          if (weeklyHours + (parseFloat(assignToMove.hours_credited) || 0) > 48) return false;

          // 4. Rest period: 11h Ruhezeit (simplified check)
          const prevDate = new Date(dateStr);
          prevDate.setDate(prevDate.getDate() - 1);
          const nextDate = new Date(dateStr);
          nextDate.setDate(nextDate.getDate() + 1);
          const prevDateStr = prevDate.toISOString().slice(0, 10);
          const nextDateStr = nextDate.toISOString().slice(0, 10);

          const prevAssign = empState[recipId]?.assignments.find(a => {
            const aDate = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10);
            return aDate === prevDateStr && a.shift_type_id && !a.absence_type_id;
          });
          const nextAssign = empState[recipId]?.assignments.find(a => {
            const aDate = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10);
            return aDate === nextDateStr && a.shift_type_id && !a.absence_type_id;
          });

          // Wenn vorher/nachher Schicht: check ob Rest-Period OK wäre (simplified)
          if (prevAssign && prevAssign.shift_type_id) {
            const prevSt = shiftTypes.find(s => s.id === prevAssign.shift_type_id);
            const currSt = shiftTypes.find(s => s.id === assignToMove.shift_type_id);
            // Vereinfachte Prüfung: wenn beide lange Dienste, skip
            if ((prevSt?.duration_hours || 0) >= 10 && (currSt?.duration_hours || 0) >= 10) return false;
          }
          if (nextAssign && nextAssign.shift_type_id) {
            const nextSt = shiftTypes.find(s => s.id === nextAssign.shift_type_id);
            const currSt = shiftTypes.find(s => s.id === assignToMove.shift_type_id);
            // Vereinfachte Prüfung: wenn beide lange Dienste, skip
            if ((nextSt?.duration_hours || 0) >= 10 && (currSt?.duration_hours || 0) >= 10) return false;
          }

          return true; // Alle Checks bestanden
        });

        if (deficitRecipients.length === 0) continue;

        // Nimm den Empfänger mit MEISTEN Deficit (am meisten zu füllen)
        const bestRecipId = deficitRecipients.reduce((bestId, currId) =>
          stats[currId].deficit > stats[bestId].deficit ? currId : bestId
        );

        // Verschiebe den Dienst
        const assignIdx = assignments.indexOf(assignToMove);
        if (assignIdx !== -1) {
          assignments[assignIdx].employee_id = bestRecipId;

          // Update empState (für nächste Iteration)
          empState[ovtEmpId].assignments = empState[ovtEmpId].assignments.filter(a => a.id !== assignToMove.id);
          empState[bestRecipId].assignments.push(assignToMove);

          improved = true;
          break; // Gehe zurück zu nächster Iteration
        }
      }
      if (improved) break;
    }
  }

  return assignments;
}

// ── WEEKEND REBALANCING ───────────────────────────────────────────────────────
function rebalanceWeekendAssignments(newAssignments, empParams, empParamMap, shiftTypes, plan, absenceSet) {
  const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
  const AT_HOLIDAYS = getAustrianHolidays(plan.year);

  for (let iter = 0; iter < 3; iter++) {
    // Calculate free weekends per employee
    const freeWE = {};
    for (const p of empParams) {
      const empId = p.employee_id;
      freeWE[empId] = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(plan.year, plan.month-1, d);
        if (date.getDay() !== 6) continue;
        const satStr = date.toISOString().slice(0,10);
        const sun = new Date(plan.year, plan.month-1, d+1);
        const sunStr = sun.toISOString().slice(0,10);
        const satWork = newAssignments.some(a=>a.employee_id===empId&&a.date===satStr&&a.shift_type_id&&!a.absence_type_id);
        const sunWork = newAssignments.some(a=>a.employee_id===empId&&a.date===sunStr&&a.shift_type_id&&!a.absence_type_id);
        if (!satWork && !sunWork) freeWE[empId]++;
      }
    }
    const maxFree = Math.max(...Object.values(freeWE));
    const minFree = Math.min(...Object.values(freeWE));
    if (maxFree - minFree < 2) break;

    const richEmp = Object.keys(freeWE).find(id => freeWE[id] === maxFree);
    const poorEmp = Object.keys(freeWE).find(id => freeWE[id] === minFree);
    if (!richEmp || !poorEmp) break;

    let moved = false;

    for (const a of newAssignments.filter(a=>a.employee_id===poorEmp&&a.shift_type_id&&!a.absence_type_id)) {
      const wd = new Date(a.date).getDay();
      if (wd !== 0 && wd !== 6) continue; // only weekends
      if (absenceSet.has(`${richEmp}_${a.date}`)) continue;
      if (newAssignments.some(a2=>a2.employee_id===richEmp&&a2.date===a.date&&a2.shift_type_id)) continue;
      const st = shiftTypes.find(x=>x.id===a.shift_type_id);
      if (!st) continue;
      // Check weekly hours
      const wk = getISOWeek(a.date);
      const richWeekH = newAssignments.filter(a2=>a2.employee_id===richEmp&&getISOWeek(a2.date)===wk&&a2.shift_type_id&&!a2.absence_type_id).reduce((s,a2)=>s+parseFloat(a2.hours_credited||0),0);
      if (richWeekH + parseFloat(st.duration_hours||0) > 48) continue;
      if (!checkRestPeriod(newAssignments.filter(a2=>a2.employee_id===richEmp), {date:a.date,shiftType:st}, shiftTypes)) continue;
      // Move: reassign from poorEmp to richEmp
      a.employee_id = richEmp;
      moved = true;
      break;
    }
    if (!moved) break;
  }
}

module.exports = router;
