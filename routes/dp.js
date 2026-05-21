'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── SHIFT TYPES ───────────────────────────────────────────────────────────────

router.get('/shift-types', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_shift_types ORDER BY sort_order, name')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/shift-types', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name,code,location,role,startTime,endTime,durationHours,isNight,isZulage,color,sortOrder} = req.body;
  if (!name?.trim()||!code?.trim()) return bad(res,'Name und Code erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_shift_types (id,name,code,location,role,start_time,end_time,duration_hours,is_night,is_zulage,color,sort_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [newId(),name.trim(),code.trim().toUpperCase(),location||'',role||'',startTime||'08:00',endTime||'20:00',durationHours||12,!!isNight,!!isZulage,color||'#3b6dd4',sortOrder||0,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/shift-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {name,code,location,role,startTime,endTime,durationHours,isNight,isZulage,color,sortOrder} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_shift_types SET name=$1,code=$2,location=$3,role=$4,start_time=$5,end_time=$6,
       duration_hours=$7,is_night=$8,is_zulage=$9,color=$10,sort_order=$11 WHERE id=$12 RETURNING *`,
      [name,code?.toUpperCase(),location||'',role||'',startTime,endTime,durationHours,!!isNight,!!isZulage,color,sortOrder||0,req.params.id]
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

// ── SHIFT REQUIREMENTS ────────────────────────────────────────────────────────

router.get('/shift-requirements', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_shift_requirements ORDER BY shift_type_id, applies_to, weekday')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/shift-requirements', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {shiftTypeId,appliesTo,weekday,specificDate,slotCount} = req.body;
  if (!shiftTypeId||!slotCount) return bad(res,'Schichttyp und Anzahl erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_shift_requirements (id,shift_type_id,applies_to,weekday,specific_date,slot_count,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId(),shiftTypeId,appliesTo||'weekday',weekday||null,specificDate||null,slotCount,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/shift-requirements/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {slotCount,weekday,appliesTo,specificDate} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_shift_requirements SET slot_count=$1,weekday=$2,applies_to=$3,specific_date=$4 WHERE id=$5 RETURNING *`,
      [slotCount,weekday||null,appliesTo,specificDate||null,req.params.id]
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
  const {code,label,color,hoursCalculation,fixedHours,adjustsMonthlyTarget,blocksScheduling,reopensShift,countsAsWorked,requiresApproval,sortOrder} = req.body;
  if (!code?.trim()||!label?.trim()) return bad(res,'Code und Label erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO dp_absence_types (id,code,label,color,hours_calculation,fixed_hours,adjusts_monthly_target,blocks_scheduling,reopens_shift,counts_as_worked,requires_approval,sort_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [newId(),code.trim().toUpperCase(),label.trim(),color||'#f59e0b',hoursCalculation||'daily_target',fixedHours||null,!!adjustsMonthlyTarget,blocksScheduling!==false,reopensShift!==false,countsAsWorked!==false,!!requiresApproval,sortOrder||0,req.uid]
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/absence-types/:id', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {code,label,color,hoursCalculation,fixedHours,adjustsMonthlyTarget,blocksScheduling,reopensShift,countsAsWorked,requiresApproval,sortOrder} = req.body;
  try {
    const row = await q1(
      `UPDATE dp_absence_types SET code=$1,label=$2,color=$3,hours_calculation=$4,fixed_hours=$5,
       adjusts_monthly_target=$6,blocks_scheduling=$7,reopens_shift=$8,counts_as_worked=$9,
       requires_approval=$10,sort_order=$11 WHERE id=$12 RETURNING *`,
      [code?.toUpperCase(),label,color,hoursCalculation,fixedHours||null,!!adjustsMonthlyTarget,blocksScheduling!==false,reopensShift!==false,countsAsWorked!==false,!!requiresApproval,sortOrder||0,req.params.id]
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
  try { ok(res, await q('SELECT * FROM dp_employee_params ORDER BY employee_id')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/employee-params', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId,monthlyHours,canDoNights,maxNightsPerMonth,doubleNightsAllowed,isSpringer} = req.body;
  if (!employeeId) return bad(res,'Mitarbeiter erforderlich',400);
  const mh = parseFloat(monthlyHours)||160;
  // weekly_hours stored for legacy compatibility (monthly / 4.33)
  const wh = Math.round(mh / 4.33 * 100) / 100;
  try {
    const existing = await q1('SELECT id FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
    if (existing) {
      const row = await q1(
        `UPDATE dp_employee_params SET monthly_hours=$1,weekly_hours=$2,can_do_nights=$3,
         max_nights_per_month=$4,double_nights_allowed=$5,is_springer=$6,updated_at=NOW() WHERE employee_id=$7 RETURNING *`,
        [mh,wh,canDoNights!==false,maxNightsPerMonth||null,doubleNightsAllowed!==false,!!isSpringer,employeeId]
      );
      return ok(res,row);
    }
    const row = await q1(
      `INSERT INTO dp_employee_params (id,employee_id,monthly_hours,weekly_hours,work_days_per_week,can_do_nights,max_nights_per_month,double_nights_allowed,is_springer,springer_config,locations,created_by)
       VALUES ($1,$2,$3,$4,5,$5,$6,$7,$8,'{}','[]',$9) RETURNING *`,
      [newId(),employeeId,mh,wh,canDoNights!==false,maxNightsPerMonth||null,doubleNightsAllowed!==false,!!isSpringer,req.uid]
      /* Note: work_days_per_week literal 5 kept for schema compat, no longer user-input */
    );
    ok(res,row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── EMPLOYEE QUALIFICATIONS ───────────────────────────────────────────────────

router.get('/employee-qualifications', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM dp_employee_qualifications ORDER BY employee_id, shift_type_id')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/employee-qualifications', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  const {employeeId, shiftTypeId} = req.body;
  if (!employeeId||!shiftTypeId) return bad(res,'Pflichtfelder fehlen',400);
  try {
    const row = await q1(
      `INSERT INTO dp_employee_qualifications (id,employee_id,shift_type_id,created_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (employee_id,shift_type_id) DO NOTHING RETURNING *`,
      [newId(),employeeId,shiftTypeId,req.uid]
    );
    ok(res, row||{employeeId,shiftTypeId});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/employee-qualifications/:empId/:stId', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    await q('DELETE FROM dp_employee_qualifications WHERE employee_id=$1 AND shift_type_id=$2',[req.params.empId,req.params.stId]);
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

    const [shiftTypes, requirements, assignments, empParams, absenceTypes] = await Promise.all([
      q('SELECT * FROM dp_shift_types ORDER BY sort_order, name'),
      q('SELECT * FROM dp_shift_requirements'),
      q('SELECT * FROM dp_assignments WHERE plan_id=$1 ORDER BY date, employee_id',[req.params.id]),
      q('SELECT * FROM dp_employee_params'),
      q('SELECT * FROM dp_absence_types ORDER BY sort_order'),
    ]);

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
        if (open > 0) openSlots[day.date][stId] = open;
      }
    }

    // Calculate monthly summary per employee
    const empParamMap = {};
    for (const p of empParams) empParamMap[p.employee_id] = p;

    const summaryMap = {};
    for (const a of assignments) {
      const empId = a.employee_id;
      if (!summaryMap[empId]) summaryMap[empId] = {actualHours:0,nightsWorked:0,weekendDays:0,freeWeekends:0,sickDays:0,vacationDays:0,zulageDays:0,leaveDays:0};
      const s = summaryMap[empId];
      const dateStr = a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date).slice(0,10);
      const wd = new Date(dateStr).getDay();
      const isWE = wd===0||wd===6;
      s.actualHours += parseFloat(a.hours_credited)||0;
      if (a.shift_type_id) {
        const st = shiftTypes.find(x=>x.id===a.shift_type_id);
        if (st?.is_night) s.nightsWorked++;
        if (st?.is_zulage) s.zulageDays++;
        if (isWE) s.weekendDays++;
      }
      if (a.absence_type_id) {
        const at = absenceTypes.find(x=>x.id===a.absence_type_id);
        if (at) {
          if (at.code==='K') s.sickDays++;
          else if (at.code==='U') s.vacationDays++;
          else if (at.adjusts_monthly_target) s.leaveDays++;
        }
      }
    }

    // Calculate target hours per employee (adjusted for leave)
    for (const [empId, s] of Object.entries(summaryMap)) {
      const params = empParamMap[empId];
      if (!params) continue;
      const workDays = getWorkDaysInMonth(plan.year, plan.month, AT_HOLIDAYS);
      const dailyTarget = params.weekly_hours / params.work_days_per_week;
      const adjustedTarget = Math.max(0, (workDays - s.leaveDays) * dailyTarget);
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
    });
  } catch(e) { console.error('[dp/matrix]',e.message); bad(res,'Serverfehler',500); }
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
            const params = await q1('SELECT weekly_hours,work_days_per_week FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
            hoursCredited = params ? parseFloat(params.weekly_hours)/parseInt(params.work_days_per_week) : 8;
            hoursSource = 'daily_target';
          }
        } else if (at.hours_calculation==='daily_target') {
          const params = await q1('SELECT weekly_hours,work_days_per_week FROM dp_employee_params WHERE employee_id=$1',[employeeId]);
          hoursCredited = params ? parseFloat(params.weekly_hours)/parseInt(params.work_days_per_week) : 8;
          hoursSource = 'daily_target';
        } else if (at.hours_calculation==='zero') {
          hoursCredited = 0; hoursSource = 'zero';
        } else if (at.hours_calculation==='fixed') {
          hoursCredited = parseFloat(at.fixed_hours)||0; hoursSource = 'fixed';
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

    ok(res,{...row, date: row.date instanceof Date ? row.date.toISOString().slice(0,10) : String(row.date).slice(0,10)});
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

    const [shiftTypes,requirements,empParams,existingAssignments,wishDays,absenceTypes,qualifications] = await Promise.all([
      q('SELECT * FROM dp_shift_types ORDER BY sort_order'),
      q('SELECT * FROM dp_shift_requirements'),
      q('SELECT * FROM dp_employee_params'),
      q(`SELECT * FROM dp_assignments WHERE plan_id=$1`,[req.params.id]),
      q('SELECT * FROM dp_wish_days WHERE month=$1 AND year=$2',[plan.month,plan.year]),
      q('SELECT * FROM dp_absence_types'),
      q('SELECT * FROM dp_employee_qualifications'),
    ]);

    const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
    const AT_HOLIDAYS = getAustrianHolidays(plan.year);

    // Build qualification maps:
    // empQualMap: empId -> Set of shiftTypeIds the employee is qualified for
    // An employee with zero qualifications cannot be auto-scheduled at all.
    const empQualMap = {};
    for (const q_ of qualifications) {
      if (!empQualMap[q_.employee_id]) empQualMap[q_.employee_id] = new Set();
      empQualMap[q_.employee_id].add(q_.shift_type_id);
    }

    // Build all required slots, sorted: nights first → weekends → date
    const slots = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(plan.year, plan.month-1, d);
      const dateStr = date.toISOString().slice(0,10);
      const wd = date.getDay();
      const dayInfo = {date:dateStr, weekday:wd, isWeekend:wd===0||wd===6, isHoliday:!!AT_HOLIDAYS[dateStr]};
      for (const st of shiftTypes) {
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
        nightsAssigned: 0,
        weekendsAssigned: 0,
        // weekly hours tracking: weekKey (YYYY-Www) -> hours
        weeklyHours: {},
        assignments: existingAssignments.filter(a=>a.employee_id===p.employee_id).map(a=>({
          ...a, date: a.date?.toString().slice(0,10),
          shiftType: shiftTypes.find(s=>s.id===a.shift_type_id)||null,
        })),
      };
      // Seed with existing assignment hours
      for (const a of empState[p.employee_id].assignments) {
        if (!a.absence_type_id) {
          empState[p.employee_id].hoursAssigned += parseFloat(a.hours_credited)||0;
          const wk = getISOWeek(a.date);
          empState[p.employee_id].weeklyHours[wk] = (empState[p.employee_id].weeklyHours[wk]||0) + (parseFloat(a.hours_credited)||0);
        }
      }
    }

    const wishSet = new Set(wishDays.map(w=>`${w.employee_id}_${w.date?.toString().slice(0,10)||w.date}`));
    const absenceSet = new Set(existingAssignments.filter(a=>a.absence_type_id).map(a=>`${a.employee_id}_${a.date?.toString().slice(0,10)}`));

    const newAssignments = [];

    for (const slot of slots) {
      const slotHours = parseFloat(slot.shiftType.duration_hours)||0;
      const slotEndH = getShiftEndHour(slot.shiftType);
      const candidates = [];

      for (const [empId, state] of Object.entries(empState)) {
        const params = empParamMap[empId];
        if (!params) continue;

        // Hard: employee must have at least one qualification defined,
        // and must be qualified for this specific shift type
        const empQuals = empQualMap[empId];
        if (!empQuals || empQuals.size === 0) continue;
        if (!empQuals.has(slot.shiftTypeId)) continue;

        // Hard: blocked by absence
        if (absenceSet.has(`${empId}_${slot.date}`)) continue;

        // Hard: already has a shift on this day
        if (state.assignments.some(a=>a.date===slot.date && a.shift_type_id && !a.absence_type_id)) continue;

        // Hard: monthly hours cap — don't exceed target (allow up to +shift for last slot)
        if (state.hoursAssigned >= state.monthlyTarget) continue;

        // Hard: Austrian law — 48h/week cap
        const wk = getISOWeek(slot.date);
        if ((state.weeklyHours[wk]||0) + slotHours > 48) continue;

        // Hard: night restriction
        if (slot.shiftType.is_night && !params.can_do_nights) continue;

        // Hard: max nights/month
        if (slot.shiftType.is_night && params.max_nights_per_month!==null &&
            state.nightsAssigned >= params.max_nights_per_month) continue;

        // Hard: Austrian Arbeitszeitgesetz — 11h minimum rest between shifts
        // Check previous shift end + 11h <= this shift start
        // Check this shift end + 11h <= next already-assigned shift start
        if (!checkRestPeriod(state.assignments, slot, shiftTypes)) continue;

        // Hard: max 6 consecutive days
        if (getConsecutiveDays(state.assignments, slot.date) >= 6) continue;

        const isWishDay = wishSet.has(`${empId}_${slot.date}`);
        const hoursDeficit = state.monthlyTarget - state.hoursAssigned;
        let score = -hoursDeficit;
        if (slot.shiftType.is_night) score += state.nightsAssigned * 50;
        if (slot.isWeekend || slot.isHoliday) score += state.weekendsAssigned * 30;
        if (isWishDay) score += 10000;

        candidates.push({empId, score});
      }

      if (candidates.length === 0) continue;

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
      newAssignments.push(assignment);

      const state = empState[winnerId];
      state.hoursAssigned += slotHours;
      const wk = getISOWeek(slot.date);
      state.weeklyHours[wk] = (state.weeklyHours[wk]||0) + slotHours;
      if (st.is_night) state.nightsAssigned++;
      if (slot.isWeekend||slot.isHoliday) state.weekendsAssigned++;
      state.assignments.push(assignment);
    }

    if (newAssignments.length > 0) {
      for (const a of newAssignments) {
        await pool.query(
          `INSERT INTO dp_assignments (id,plan_id,employee_id,date,shift_type_id,absence_type_id,hours_credited,hours_source,is_overtime,is_locked,source,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,'generated',$9,$10)`,
          [a.id,a.plan_id,a.employee_id,a.date,a.shift_type_id,null,a.hours_credited,'shift',a.notes,a.created_by]
        ).catch(()=>{});
      }
    }

    await pool.query(`UPDATE dp_plans SET generated_at=NOW(),generated_by=$1,status='reviewed' WHERE id=$2`,[req.uid,plan.id]);

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

    ok(res, {generated: newAssignments.length, total: slots.length, violations: violatedWishDays.length});
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
  const {date,month,year,reason} = req.body;
  if (!date||!month||!year) return bad(res,'Datum erforderlich',400);
  try {
    // Check max 3 per month
    const existing = await q('SELECT id FROM dp_wish_days WHERE employee_id=$1 AND month=$2 AND year=$3',[req.uid,month,year]);
    if (existing.length >= 3) return bad(res,'Maximal 3 Wunschtage pro Monat',400);
    const row = await q1(
      `INSERT INTO dp_wish_days (id,employee_id,month,year,date,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(),req.uid,month,year,date,reason||'']
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

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getRequiredCount(requirements, shiftTypeId, dayInfo) {
  // Check specific date first
  const specific = requirements.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='date' && r.specific_date?.toString().slice(0,10)===dayInfo.date);
  if (specific) return specific.slot_count;
  // Holiday
  if (dayInfo.isHoliday) {
    const hol = requirements.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='holiday');
    if (hol) return hol.slot_count;
  }
  // Weekend
  if (dayInfo.isWeekend) {
    const we = requirements.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekend');
    if (we) return we.slot_count;
  }
  // Specific weekday
  const wdReq = requirements.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===dayInfo.weekday);
  if (wdReq) return wdReq.slot_count;
  // General weekday
  const general = requirements.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===null);
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

module.exports = router;
