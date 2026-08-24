'use strict';
require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const path         = require('path');
const crypto       = require('crypto');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');

const PORT   = parseInt(process.env.PORT || '3000');
const SECRET = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL fehlt!'); process.exit(1); }
if (SECRET.startsWith('bitte-aendern-')) console.warn('⚠️  SESSION_SECRET nicht gesetzt!');

const { pool, q, q1, newId } = require('./db');
const bcrypt = require('bcryptjs');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL,
      roles JSONB NOT NULL DEFAULT '["standard"]', color TEXT NOT NULL DEFAULT '#3b6dd4',
      pw_hash TEXT NOT NULL, must_change_pw BOOLEAN NOT NULL DEFAULT true,
      last_seen TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '📌',
      color TEXT NOT NULL DEFAULT '#64748b', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#3b6dd4'
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, is_general BOOLEAN NOT NULL DEFAULT false,
      date_from TEXT NOT NULL, date_to TEXT NOT NULL,
      time_from TEXT DEFAULT '', time_to TEXT DEFAULT '',
      user_id TEXT, category TEXT, reason TEXT NOT NULL,
      approval_status TEXT DEFAULT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_confirms (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL,
      confirmed_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(event_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT DEFAULT '', department TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]', priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open', bucket TEXT DEFAULT '',
      is_public BOOLEAN NOT NULL DEFAULT false,
      assignee_id TEXT, parent_ticket_id TEXT, created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_notes (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text TEXT NOT NULL, author_id TEXT NOT NULL,
      note_type TEXT NOT NULL DEFAULT 'note', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS allowances (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
      nd INTEGER DEFAULT 0, fd INTEGER DEFAULT 0, fw INTEGER DEFAULT 0, c10 INTEGER DEFAULT 0,
      UNIQUE (user_id, year, month)
    );
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS checklist_template_items (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      text TEXT NOT NULL, item_type TEXT NOT NULL DEFAULT 'check', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ticket_checklists (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      template_id TEXT, name TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_checklist_items (
      id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL REFERENCES ticket_checklists(id) ON DELETE CASCADE,
      text TEXT NOT NULL, item_type TEXT NOT NULL DEFAULT 'check', sort_order INTEGER DEFAULT 0,
      completed_by TEXT, completed_at TIMESTAMPTZ, user_note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      sender_id TEXT NOT NULL, target_type TEXT NOT NULL DEFAULT 'all', target_value TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, read_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, ticket_id TEXT, note_id TEXT, event_id TEXT,
      created_by TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS abrechnung_einspringer (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      edate TEXT NOT NULL, note TEXT DEFAULT '',
      rejected_by TEXT, rejected_reason TEXT, rejected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS abrechnung_homeoffice (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      year INTEGER NOT NULL, month INTEGER NOT NULL, days INTEGER DEFAULT 0,
      UNIQUE(user_id, year, month)
    );
    CREATE TABLE IF NOT EXISTS dienstplaene (
      id TEXT PRIMARY KEY, month INTEGER NOT NULL, year INTEGER NOT NULL,
      label TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      filename TEXT NOT NULL, file_data TEXT NOT NULL,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS zahnarzt_dienste (
      id TEXT PRIMARY KEY, bezirk TEXT NOT NULL DEFAULT '',
      datum DATE NOT NULL, tag TEXT NOT NULL DEFAULT '',
      uhrzeit TEXT NOT NULL DEFAULT '', erreichbarkeit TEXT NOT NULL DEFAULT '',
      zahnarzt TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const migs = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`,
    `ALTER TABLE ticket_subcategories ADD COLUMN IF NOT EXISTS is_complaint BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE checklist_template_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'check'`,
    `ALTER TABLE ticket_checklist_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'check'`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id TEXT`,
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_by TEXT`,
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_reason TEXT`,
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_user_id TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_department TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS title TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS body TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS approved TEXT DEFAULT 'pending'`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS todo_status TEXT DEFAULT NULL`,
    `ALTER TABLE ticket_notes ALTER COLUMN author_id DROP NOT NULL`,
    `CREATE TABLE IF NOT EXISTS message_reads (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(message_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, action TEXT NOT NULL, details JSONB DEFAULT '{}', ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
  ];
  // activity_log Tabelle (falls noch nicht vorhanden)
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT,
    action TEXT NOT NULL, details JSONB DEFAULT '{}',
    ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`).catch(()=>{});
  const migs2 = [
    `ALTER TABLE message_reads ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS homeoffice_config (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      max_slots INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS homeoffice_slots (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      user_id TEXT NOT NULL,
      box TEXT NOT NULL DEFAULT '',
      dienst TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS homeoffice_boxes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS homeoffice_dienste (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS mentioned_users JSONB DEFAULT '[]'`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS mentioned_users JSONB DEFAULT '[]'`,
    // Explizit hinzugefügte Ticket-Teilnehmer (unabhängig von @-Erwähnungen in
    // Notizen) — dürfen das Ticket unabhängig von Fachbereich/Sichtbarkeit sehen.
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'`,
    `CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      from_date DATE, to_date DATE, is_important BOOLEAN DEFAULT false,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS news_pins (
      news_id TEXT NOT NULL, user_id TEXT NOT NULL,
      PRIMARY KEY (news_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS vacation_config (
      id TEXT PRIMARY KEY, date DATE NOT NULL UNIQUE,
      max_slots INTEGER NOT NULL DEFAULT 8,
      note TEXT DEFAULT '',
      created_by TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS diensttausch (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(), status TEXT DEFAULT 'pending',
      decided_by TEXT, decided_at TIMESTAMPTZ, reject_reason TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS diensttausch_reads (
      diensttausch_id TEXT NOT NULL, user_id TEXT NOT NULL,
      read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (diensttausch_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_views (
      ticket_id TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      viewed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (ticket_id, user_id)
    )`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename='ticket_number_seq') THEN
        CREATE SEQUENCE ticket_number_seq;
        PERFORM setval('ticket_number_seq', COALESCE(
          (SELECT MAX(CAST(REPLACE(number,'TK-','') AS INTEGER)) FROM tickets WHERE number ~ '^TK-[0-9]+$'),
          1000
        ));
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS ticket_subcategories (
      id TEXT PRIMARY KEY, department TEXT NOT NULL,
      label TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT ''`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_date DATE`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS snoozed_until DATE`,
    `CREATE TABLE IF NOT EXISTS note_templates (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, body TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by TEXT`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter TEXT DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS station_shifts (
      id TEXT PRIMARY KEY, label TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS station_sessions (
      id TEXT PRIMARY KEY, station_name TEXT NOT NULL,
      user_id TEXT NOT NULL, shift_id TEXT,
      logged_in_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(station_name), UNIQUE(user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_files (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL,
      filename TEXT NOT NULL, original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE ticket_files ADD COLUMN IF NOT EXISTS file_data TEXT`,
    `CREATE TABLE IF NOT EXISTS doc_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      icon TEXT DEFAULT '📁', color TEXT DEFAULT '#3b6dd4',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE doc_categories ADD COLUMN IF NOT EXISTS parent_id TEXT`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_status TEXT`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_result TEXT`,
    `ALTER TABLE todos ADD COLUMN IF NOT EXISTS ai_status TEXT`,
    `ALTER TABLE todos ADD COLUMN IF NOT EXISTS ai_result TEXT`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS ai_status TEXT`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS ai_result TEXT`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, category_id TEXT,
      title TEXT NOT NULL, description TEXT DEFAULT '',
      filename TEXT NOT NULL, original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      current_version INTEGER DEFAULT 1,
      uploaded_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY, document_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      filename TEXT NOT NULL, original_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data TEXT`,
    `ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_data TEXT`,
    `ALTER TABLE station_shifts ADD COLUMN IF NOT EXISTS service_start TEXT DEFAULT ''`,
    `ALTER TABLE station_shifts ADD COLUMN IF NOT EXISTS service_end TEXT DEFAULT ''`,
    `ALTER TABLE station_shifts ADD COLUMN IF NOT EXISTS has_break BOOLEAN DEFAULT true`,
    `ALTER TABLE station_sessions ADD COLUMN IF NOT EXISTS break_time TEXT DEFAULT NULL`,
    `CREATE TABLE IF NOT EXISTS portal_links (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, url TEXT NOT NULL,
      icon TEXT DEFAULT '🔗', description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS station_outages (
      id TEXT PRIMARY KEY, station_name TEXT NOT NULL,
      reason TEXT DEFAULT '',
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL, permission TEXT NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT true,
      PRIMARY KEY (role, permission)
    )`,
    `CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'einmalig',
  rhythm TEXT DEFAULT NULL,
  rhythm_day INTEGER DEFAULT NULL,
  rhythm_time TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS meeting_instances (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  date DATE NOT NULL, time TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS discussion_items (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES meeting_instances(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE DEFAULT NULL, meeting_date DATE DEFAULT NULL,
  parent_id TEXT DEFAULT NULL, delegated_to TEXT DEFAULT NULL,
  result TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS discussion_participants (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES discussion_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'required',
  UNIQUE(item_id, user_id)
)`,
    `CREATE TABLE IF NOT EXISTS dp_shift_types (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL,
  location TEXT DEFAULT '', role TEXT DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '08:00', end_time TEXT NOT NULL DEFAULT '20:00',
  duration_hours NUMERIC(4,2) NOT NULL DEFAULT 12,
  is_night BOOLEAN NOT NULL DEFAULT false,
  is_zulage BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#3b6dd4',
  sort_order INTEGER DEFAULT 0,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_shift_requirements (
  id TEXT PRIMARY KEY, shift_type_id TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'weekday',
  weekday INTEGER DEFAULT NULL,
  specific_date DATE DEFAULT NULL,
  slot_count INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_absence_types (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  hours_calculation TEXT NOT NULL DEFAULT 'daily_target',
  fixed_hours NUMERIC(4,2) DEFAULT NULL,
  adjusts_monthly_target BOOLEAN NOT NULL DEFAULT false,
  blocks_scheduling BOOLEAN NOT NULL DEFAULT true,
  reopens_shift BOOLEAN NOT NULL DEFAULT true,
  counts_as_worked BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_employee_params (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL UNIQUE,
  weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
  work_days_per_week INTEGER NOT NULL DEFAULT 5,
  can_do_nights BOOLEAN NOT NULL DEFAULT true,
  max_nights_per_month INTEGER DEFAULT NULL,
  double_nights_allowed BOOLEAN NOT NULL DEFAULT true,
  is_springer BOOLEAN NOT NULL DEFAULT false,
  springer_config JSONB DEFAULT '{}',
  locations JSONB DEFAULT '[]',
  created_by TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_plans (
  id TEXT PRIMARY KEY, month INTEGER NOT NULL, year INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ, published_by TEXT,
  generated_at TIMESTAMPTZ, generated_by TEXT,
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
)`,
    `CREATE TABLE IF NOT EXISTS dp_assignments (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
  employee_id TEXT NOT NULL, date DATE NOT NULL,
  shift_type_id TEXT DEFAULT NULL,
  absence_type_id TEXT DEFAULT NULL,
  hours_credited NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_source TEXT NOT NULL DEFAULT 'shift',
  is_overtime BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_wish_days (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL,
  month INTEGER NOT NULL, year INTEGER NOT NULL,
  date DATE NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  violated_reason TEXT DEFAULT '',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_swap_requests (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
  requester_id TEXT NOT NULL, requester_assignment_id TEXT NOT NULL,
  target_employee_id TEXT, target_assignment_id TEXT,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_target',
  constraint_warning TEXT DEFAULT '',
  decided_by TEXT, decided_at TIMESTAMPTZ, reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_audit_log (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
  date DATE, employee_id TEXT,
  action TEXT NOT NULL,
  old_value JSONB DEFAULT '{}', new_value JSONB DEFAULT '{}',
  reason TEXT DEFAULT '',
  performed_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_employee_qualifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  shift_type_id TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, shift_type_id)
)`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS monthly_hours NUMERIC(6,2) NOT NULL DEFAULT 160`,
    `CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE DEFAULT NULL,
  assigned_to TEXT DEFAULT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS todo_items (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  comment TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  done_by TEXT DEFAULT NULL,
  done_at TIMESTAMPTZ DEFAULT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS todo_item_assignees (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, user_id)
)`,
    `ALTER TABLE meeting_instances ALTER COLUMN date DROP NOT NULL`,
    `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS link TEXT DEFAULT NULL`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS protokoll JSONB DEFAULT '[]'`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS group_id TEXT DEFAULT NULL`,
    `ALTER TABLE meeting_instances ADD COLUMN IF NOT EXISTS title TEXT DEFAULT NULL`,
    `ALTER TABLE todos ADD COLUMN IF NOT EXISTS protokoll JSONB DEFAULT '[]'`,
    `ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL`,
    `ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS converted_ticket_id TEXT DEFAULT NULL`,
    `ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ DEFAULT NULL`,
    `ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS converted_by TEXT DEFAULT NULL`,
    `ALTER TABLE dp_shift_types ADD COLUMN IF NOT EXISTS is_office BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS office_pct INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS fd_springer_type TEXT DEFAULT NULL`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS fd_springer_location TEXT DEFAULT NULL`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS fd_springer_shifts_per_month INTEGER DEFAULT NULL`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS link TEXT DEFAULT NULL`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS converted_ticket_id TEXT DEFAULT NULL`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ DEFAULT NULL`,
    `ALTER TABLE discussion_items ADD COLUMN IF NOT EXISTS converted_by TEXT DEFAULT NULL`,
    `CREATE TABLE IF NOT EXISTS todo_item_notifications (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  notified_by TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'comment',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, user_id, type)
)`,
    `CREATE TABLE IF NOT EXISTS dp_generation_protocol (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES dp_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_type_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  employee_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
    `ALTER TABLE dp_shift_requirements ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
    `ALTER TABLE dp_shift_requirements ADD COLUMN IF NOT EXISTS valid_until DATE DEFAULT NULL`,
    `ALTER TABLE dp_employee_qualifications ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
    `ALTER TABLE dp_shift_types ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
    `ALTER TABLE dp_absence_types ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
    `ALTER TABLE dp_absence_types ADD COLUMN IF NOT EXISTS is_holiday_default BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE dp_employee_params DROP CONSTRAINT IF EXISTS dp_employee_params_employee_id_key`,
    `CREATE UNIQUE INDEX IF NOT EXISTS dp_emp_params_null_vf ON dp_employee_params(employee_id) WHERE valid_from IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS dp_emp_params_date_vf ON dp_employee_params(employee_id, valid_from) WHERE valid_from IS NOT NULL`,
    `ALTER TABLE dp_employee_qualifications DROP CONSTRAINT IF EXISTS dp_employee_qualifications_employee_id_shift_type_id_key`,
    `CREATE UNIQUE INDEX IF NOT EXISTS dp_qual_null_vf ON dp_employee_qualifications(employee_id, shift_type_id) WHERE valid_from IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS dp_qual_date_vf ON dp_employee_qualifications(employee_id, shift_type_id, valid_from) WHERE valid_from IS NOT NULL`,
    `ALTER TABLE dp_shift_types ADD COLUMN IF NOT EXISTS valid_until DATE DEFAULT NULL`,
    `ALTER TABLE dp_shift_types ADD COLUMN IF NOT EXISTS max_per_emp_per_month INTEGER DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL`,
    `ALTER TABLE dp_plans ADD COLUMN IF NOT EXISTS generation_report JSONB DEFAULT NULL`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS daily_hours NUMERIC(4,2) DEFAULT NULL`,
    `CREATE TABLE IF NOT EXISTS dp_shift_preferences (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      shift_type_id TEXT NOT NULL,
      preference_weight INTEGER NOT NULL DEFAULT 0,
      valid_from DATE DEFAULT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, shift_type_id, valid_from)
    )`,
    `CREATE TABLE IF NOT EXISTS dp_hours_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      monthly_hours NUMERIC(6,2) NOT NULL DEFAULT 160,
      daily_work_hours NUMERIC(4,2) DEFAULT NULL,
      avg_shift_duration NUMERIC(4,2) DEFAULT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS profile_id TEXT DEFAULT NULL`,
    `CREATE TABLE IF NOT EXISTS dp_emp_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#64748b',
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS no_weekends BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE dp_employee_params ADD COLUMN IF NOT EXISTS xmas_rotation_participant BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE dp_absence_types ADD COLUMN IF NOT EXISTS zero_on_free_days BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS dp_plan_versions (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
  version_name TEXT NOT NULL,
  assignments JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_emp_rules (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  day_of_week INTEGER DEFAULT NULL,
  shift_type_id TEXT DEFAULT NULL,
  valid_from DATE DEFAULT NULL,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS dp_christmas_history (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year, day_key)
)`,
    `CREATE TABLE IF NOT EXISTS dp_christmas_wishes (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  wants_off BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year, day_key)
)`,
    // Nullable, damit bestehende Nutzer nicht brechen — "Pflichtfeld" wird nur
    // im Formular für NEUE Mitarbeiter erzwungen. Aktiv-Status wird zentral aus
    // diesen beiden Daten abgeleitet (db.isUserActive), kein separates Flag.
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS termination_date DATE`,
    // Wunsch-Modell umgestellt: ein Wunsch je Kalendertag (U/TD/ND) statt
    // "wants_off" je Tag/Schichtart-Kombination. day_key-Domäne schrumpft von
    // 10 auf 5 Werte (UNIQUE-Constraint bleibt gültig). wants_off bleibt als
    // Altspalte bestehen (nicht mehr geschrieben/gelesen) — additive Migration.
    `ALTER TABLE dp_christmas_wishes ADD COLUMN IF NOT EXISTS wish TEXT`,
    // Für die Ticket-Historie: bearbeitete Text-Einträge werden markiert
    // (Zeitpunkt der letzten Bearbeitung), die eigentliche Änderung wird
    // zusätzlich als eigener Protokoll-Eintrag (note_type='audit') erfasst.
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone1 TEXT DEFAULT '',
  phone2 TEXT DEFAULT '',
  company TEXT DEFAULT '',
  responsible_for TEXT DEFAULT '',
  availability TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
    // ── Notfall-/Vorgehens-Checklisten ("SOP") — bewusst eigener Tabellen-
    // Präfix "sop_", da "checklist_templates"/"checklist_template_items"
    // bereits für die (davon unabhängigen) Ticket-Checklisten-Vorlagen
    // vergeben sind. base_id verbindet alle Versionen einer Checkliste
    // (Versionierung: eine Änderung an einer freigegebenen Checkliste legt
    // eine neue Zeile mit version+1 an, statt die alte zu überschreiben —
    // damit bleiben abgeschlossene Durchläufe mit ihrer damals gültigen
    // Version verknüpft).
    `CREATE TABLE IF NOT EXISTS sop_checklists (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  active BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  last_printed_at TIMESTAMPTZ
)`,
    `CREATE TABLE IF NOT EXISTS sop_checklist_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES sop_checklists(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  item_type TEXT NOT NULL DEFAULT 'check',
  hint TEXT DEFAULT ''
)`,
    `CREATE TABLE IF NOT EXISTS sop_checklist_runs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES sop_checklists(id),
  started_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
)`,
    `ALTER TABLE sop_checklist_runs ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS sop_checklist_run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sop_checklist_runs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES sop_checklist_items(id),
  done BOOLEAN NOT NULL DEFAULT false,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  UNIQUE(run_id, item_id)
)`,
    // Schritt-Typ "Kontakt": verlinkt einen bestehenden Eintrag aus dem
    // Kontakte-Modul (ON DELETE SET NULL, damit das Löschen eines Kontakts
    // keine Checkliste kaputt macht — der Schritt bleibt bestehen, nur ohne
    // Verknüpfung).
    `ALTER TABLE sop_checklist_items ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL`,
    // Dokumentations-Freitextfeld je Schritt — unabhängig vom typ-spezifischen
    // "value" (z.B. bei Checkbox/Kontakt/Foto zusätzlich Platz für Notizen).
    `ALTER TABLE sop_checklist_run_items ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`,
    // ── Spintvergabe ── ein Spind ist entweder einem Mitarbeiter zugeteilt
    // (assignee_user_id) oder anderweitig vergeben (assignee_label, z.B.
    // "Allgemein"/"Technik") oder frei (assignee_type='none'). Ein Mitarbeiter
    // kann mehrere Spinde haben, da hier je Spind (nicht je Mitarbeiter) eine
    // Zeile existiert.
    `CREATE TABLE IF NOT EXISTS lockers (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  assignee_type TEXT NOT NULL DEFAULT 'none',
  assignee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assignee_label TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS locker_categories (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, emoji TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `ALTER TABLE lockers ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES locker_categories(id) ON DELETE SET NULL`,
    // ── 1:1-Chat ── eigenständig von der bestehenden Broadcast-"Nachrichten"-
    // Funktion (Ankündigung an eine Zielgruppe, keine Threads). user1_id ist
    // immer die (string-)kleinere der beiden User-IDs — so bleibt der
    // UNIQUE-Index pro Personenpaar eindeutig, egal wer den Chat zuerst startet.
    `CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  user1_id TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `CREATE TABLE IF NOT EXISTS chat_reads (
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(thread_id, user_id)
)`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    // ── Verzweigungen in Notfall-Checklisten ── ein Schritt vom Typ "branch"
    // stellt eine Entscheidung mit mehreren benannten Optionen dar (z.B.
    // "07-19 Uhr" / "19-07 Uhr"). Andere Schritte können optional einer
    // Option zugeordnet werden (branch_option_id) — sie erscheinen dann nur,
    // wenn genau diese Option gewählt wurde. Schritte OHNE Zuordnung bleiben
    // immer sichtbar, das ist der "Hauptpfad" und zugleich der natürliche
    // Zusammenführungspunkt: sobald ein Zweig wieder untaggierte Schritte
    // erreicht, laufen beide Pfade dort automatisch wieder zusammen.
    `CREATE TABLE IF NOT EXISTS sop_checklist_item_branch_options (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES sop_checklist_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
)`,
    `ALTER TABLE sop_checklist_items ADD COLUMN IF NOT EXISTS branch_option_id TEXT REFERENCES sop_checklist_item_branch_options(id) ON DELETE SET NULL`,
    // ── Fachbereiche ── bisher fest im Code verdrahtet (db.js DEPTS), jetzt vom
    // Admin verwaltbar. id bleibt nach dem Anlegen unveränderlich (wird in
    // tickets.department und user.roles referenziert) — nur label/emoji/color
    // sind editierbar. Seed mit den bisherigen 6 Fachbereichen, damit
    // bestehende Tickets/Rollen weiter funktionieren.
    `CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  color TEXT DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
    `INSERT INTO departments (id,label,emoji,color,sort_order) VALUES
      ('technik','Technik','🔧','#0ea5e9',1),
      ('leitung','Leitung','⭐','#f59e0b',2),
      ('dienstplanung','Dienstplanung','📋','#3b6dd4',3),
      ('ausbildung','Ausbildung','🎓','#7c3aed',4),
      ('qm','QM','✅','#10b981',5),
      ('frei','Frei','🌐','#64748b',6)
    ON CONFLICT (id) DO NOTHING`,
  ];
  for (const m of migs2) { try { await pool.query(m); } catch(e) {} }
  for (const m of migs) { try { await pool.query(m); } catch(e) {} }

  // ── Benutzername-Migration ──
  // Login lief bisher über eine Namens-Auswahlliste (Sicherheits-/Datenschutzproblem:
  // jeder Besucher sah alle Mitarbeiternamen). Bestehende Nutzer ohne Benutzername
  // bekommen automatisch einen aus dem Namen generierten (vorname.nachname);
  // Admins können ihn danach in der Benutzerverwaltung anpassen.
  const slugify = s => (s||'')
    .replace(/ä/gi,'ae').replace(/ö/gi,'oe').replace(/ü/gi,'ue').replace(/ß/gi,'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'');
  const usersNoUsername = await q("SELECT id,name FROM users WHERE username IS NULL OR username=''");
  if (usersNoUsername.length) {
    const existing = new Set((await q("SELECT LOWER(username) as u FROM users WHERE username IS NOT NULL AND username!=''")).map(r=>r.u));
    for (const u of usersNoUsername) {
      const parts = (u.name||'').trim().split(/\s+/).filter(Boolean).map(slugify).filter(Boolean);
      const base = parts.length>1 ? parts[0]+'.'+parts[parts.length-1] : (parts[0]||'user');
      let candidate = base, n = 1;
      while (existing.has(candidate)) { n++; candidate = base+n; }
      existing.add(candidate);
      await pool.query('UPDATE users SET username=$1 WHERE id=$2', [candidate, u.id]);
      console.log(`  → Benutzername vergeben: ${u.name} = ${candidate}`);
    }
  }
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username)) WHERE username IS NOT NULL AND username != ''`)
    .catch(e => console.error('[username-index]', e.message));

  const cnt = await q1('SELECT COUNT(*) as n FROM users');
  if (parseInt(cnt.n) === 0) {
    const hash = await bcrypt.hash('Passwort1', 10);
    const [u1,u2,u3] = [newId(),newId(),newId()];
    await pool.query(`INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw,username) VALUES
      ($1,'Administrator','AD','["admin"]','#3b6dd4',$4,false,'admin'),
      ($2,'Dienstplanung','DP','["dienstplanung"]','#10b981',$4,false,'dienstplanung'),
      ($3,'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',$4,true,'mitarbeiter')`, [u1,u2,u3,hash]);
    const cats=[['📚','Ausbildung','#10b981',0],['🎓','Kurs','#3b6dd4',1],['🎂','Geburtstag','#e87bb0',2],
      ['📝','Dienstwunsch','#7c3aed',3],['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],['📌','Sonstiges','#64748b',6]];
    for (const [e,l,c,i] of cats) await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',[newId(),l,e,c,i]);
    for (const [l,c] of [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']])
      await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)',[newId(),l,c]);
    console.log('✓ Datenbank initialisiert – Login: Administrator / Passwort1');
  }
}

const app = express();
app.set('trust proxy', 1);

// ── SECURITY HEADERS ──
app.use(helmet({
  contentSecurityPolicy: false,   // SPA mit Inline-Handlers + Google Fonts — CSP separat konfigurieren wenn nötig
}));
app.disable('x-powered-by');

// ── RATE LIMITING ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 Minuten
  max: 10,                      // max 10 Login-Versuche pro IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: SECRET, resave: false, saveUninitialized: false, name: 'lst.sid',
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 36000000 },
}));

// ── ROUTES ──
app.use('/api/auth/login', loginLimiter);
app.use('/api',            apiLimiter);
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/data',     require('./routes/data'));
app.use('/api/events',   require('./routes/events'));
app.use('/api/tickets',  require('./routes/tickets'));
app.use('/api/zahnarzt', require('./routes/zahnarzt'));
app.use('/api',          require('./routes/docs'));
app.use('/api',          require('./routes/misc'));
app.use('/api',          require('./routes/meetings'));
app.use('/api/dp', require('./routes/dp'));
app.use('/api/dp', require('./routes/dp-christmas'));
app.use('/api',   require('./routes/todos'));
app.use('/api',   require('./routes/contacts'));
app.use('/api',   require('./routes/sop'));
app.use('/api',   require('./routes/lockers'));
app.use('/api',   require('./routes/departments'));
app.use('/api',   require('./routes/email'));
app.use('/api',   require('./routes/chat'));
app.use('/api',   require('./routes/push').router);
app.use('/api',   require('./routes/ai'));

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

// ── FÄLLIGKEITS-REMINDER (E-Mail) ──
// Prüft alle 6h: Tickets überfällig oder in <48h fällig → Mail an Zuständigen.
// Max. 1 Mail pro Ticket und Tag (In-Memory-Dedupe; Neustart → schlimmstenfalls
// eine zusätzliche Mail). Ohne SMTP-Konfiguration passiert nichts.
const _dueMailSent = new Map(); // ticketId -> YYYY-MM-DD der letzten Mail
async function checkDueTickets() {
  const { isConfigured, mailUser } = require('./lib/mailer');
  if (!isConfigured()) return;
  try {
    const { q } = require('./db');
    const rows = await q(
      `SELECT id,number,title,due_date,assignee_id FROM tickets
       WHERE status != 'closed' AND is_deleted IS NOT TRUE
         AND assignee_id IS NOT NULL AND due_date IS NOT NULL
         AND due_date <= (CURRENT_DATE + INTERVAL '2 days')`);
    const today = new Date().toISOString().slice(0,10);
    for (const tk of rows) {
      if (_dueMailSent.get(tk.id) === today) continue;
      const due = tk.due_date instanceof Date ? tk.due_date.toISOString().slice(0,10) : String(tk.due_date).slice(0,10);
      const overdue = due < today;
      const dueFmt = due.slice(8,10)+'.'+due.slice(5,7)+'.'+due.slice(0,4);
      const sent = await mailUser(tk.assignee_id,
        overdue ? `[${tk.number}] ÜBERFÄLLIG: ${tk.title}` : `[${tk.number}] Bald fällig: ${tk.title}`,
        overdue
          ? `das Ticket "${tk.title}" (${tk.number}) war am ${dueFmt} fällig und ist noch nicht abgeschlossen.`
          : `das Ticket "${tk.title}" (${tk.number}) ist am ${dueFmt} fällig.`);
      if (sent) _dueMailSent.set(tk.id, today);
    }
  } catch(e) { console.error('[due-reminder]', e.message); }
}

// ── START ──
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ LSt Portal – http://localhost:${PORT}`);
    console.log(`  DB: ${process.env.DATABASE_URL?.slice(0,40)}...`);
    console.log(`  Env: ${process.env.NODE_ENV || 'development'}\n`);
  });
  setTimeout(checkDueTickets, 60 * 1000);              // 1 min nach Start
  setInterval(checkDueTickets, 6 * 60 * 60 * 1000);    // danach alle 6h
}).catch(err => { console.error('❌ DB-Fehler:', err.message); process.exit(1); });
