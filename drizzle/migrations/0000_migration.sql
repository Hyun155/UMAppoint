
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('student','lecturer');
create type public.appointment_status as enum ('pending','approved','rejected','cancellation_requested','rescheduling_requested','cancelled','completed');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- LECTURERS
create table public.lecturers (
  id uuid primary key references public.profiles(id) on delete cascade,
  title text not null default 'Dr.',
  department text not null default 'Department of Software Engineering',
  specialization text not null default '',
  office_location text not null default '',
  consultation_info text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.lecturers to authenticated;
grant all on public.lecturers to service_role;
alter table public.lecturers enable row level security;
create policy "Lecturers readable" on public.lecturers for select to authenticated using (true);
create policy "Lecturer updates own" on public.lecturers for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- STUDENTS
create table public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  matric_no text not null default '',
  programme text not null default '',
  year_of_study int not null default 1,
  created_at timestamptz not null default now()
);
grant select, update on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;
create policy "Student reads own" on public.students for select to authenticated using (auth.uid() = id);
create policy "Lecturer reads students who booked them" on public.students for select to authenticated using (
  public.has_role(auth.uid(),'lecturer')
);
create policy "Student updates own" on public.students for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- SLOTS
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references public.lecturers(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  location_type text not null default 'physical' check (location_type in ('physical','online')),
  location text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on public.availability_slots (lecturer_id, slot_date);
grant select, insert, update, delete on public.availability_slots to authenticated;
grant all on public.availability_slots to service_role;
alter table public.availability_slots enable row level security;
create policy "Slots readable" on public.availability_slots for select to authenticated using (true);
create policy "Lecturer inserts own slots" on public.availability_slots for insert to authenticated with check (auth.uid() = lecturer_id and public.has_role(auth.uid(),'lecturer'));
create policy "Lecturer updates own slots" on public.availability_slots for update to authenticated using (auth.uid() = lecturer_id) with check (auth.uid() = lecturer_id);
create policy "Lecturer deletes own slots" on public.availability_slots for delete to authenticated using (auth.uid() = lecturer_id);

-- APPOINTMENTS
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique default ('APT-' || upper(substr(md5(random()::text),1,6))),
  student_id uuid not null references public.students(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id) on delete cascade,
  slot_id uuid references public.availability_slots(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null default '',
  purpose text not null,
  status public.appointment_status not null default 'pending',
  lecturer_note text,
  student_request_reason text,
  reschedule_slot_id uuid references public.availability_slots(id) on delete set null,
  parent_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (student_id);
create index on public.appointments (lecturer_id, appointment_date);
-- A slot can hold only one active booking (prevents double-booking)
create unique index appointments_one_active_per_slot on public.appointments (slot_id)
  where status in ('pending','approved','cancellation_requested','rescheduling_requested');
create unique index appointments_one_reschedule_target on public.appointments (reschedule_slot_id)
  where status = 'rescheduling_requested';
grant select on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "Participants read appointments" on public.appointments for select to authenticated using (auth.uid() = student_id or auth.uid() = lecturer_id);

create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.appointment_status_history to authenticated;
grant all on public.appointment_status_history to service_role;
alter table public.appointment_status_history enable row level security;
create policy "Participants read history" on public.appointment_status_history for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = appointment_id and (a.student_id = auth.uid() or a.lecturer_id = auth.uid()))
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, is_read);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications read" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Own notifications update" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own notifications delete" on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- Status history trigger
create or replace function public.log_appointment_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history(appointment_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), 'Created');
  elsif new.status is distinct from old.status then
    insert into public.appointment_status_history(appointment_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), coalesce(new.lecturer_note, new.student_request_reason));
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_appt_history_ins after insert on public.appointments for each row execute function public.log_appointment_status();
create or replace function public.touch_appt() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_appt_touch before update on public.appointments for each row execute function public.touch_appt();
create or replace function public.log_appointment_status_upd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.appointment_status_history(appointment_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), coalesce(new.lecturer_note, new.student_request_reason));
  end if;
  return new;
end $$;
create trigger trg_appt_history_upd after update on public.appointments for each row execute function public.log_appointment_status_upd();

-- Slot validation: no overlap, cannot edit/delete booked slot
create or replace function public.validate_slot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    if exists (select 1 from public.appointments where (slot_id = old.id or reschedule_slot_id = old.id)
               and status in ('pending','approved','cancellation_requested','rescheduling_requested')) then
      raise exception 'This slot has an active booking and cannot be changed or removed.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time.';
  end if;
  if exists (select 1 from public.availability_slots s
             where s.lecturer_id = new.lecturer_id and s.slot_date = new.slot_date and s.id <> new.id
               and s.start_time < new.end_time and new.start_time < s.end_time) then
    raise exception 'This slot overlaps with another of your availability slots.';
  end if;
  return new;
end $$;
create trigger trg_validate_slot before insert or update or delete on public.availability_slots for each row execute function public.validate_slot();

-- helper
create or replace function public.notify(_user uuid, _title text, _msg text, _appt uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, title, message, appointment_id) values (_user, _title, _msg, _appt);
$$;
revoke execute on function public.notify(uuid,text,text,uuid) from public, anon, authenticated;

create or replace function public.slot_is_free(_slot uuid, _ignore_appt uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.appointments
    where (slot_id = _slot and status in ('pending','approved','cancellation_requested','rescheduling_requested'))
       or (reschedule_slot_id = _slot and status = 'rescheduling_requested')
  ) and (_ignore_appt is null or true)
$$;

-- Public view of booked slot ids (no personal info)
create or replace function public.booked_slot_ids(_lecturer uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select slot_id from public.appointments where lecturer_id = _lecturer and slot_id is not null
    and status in ('pending','approved','cancellation_requested','rescheduling_requested')
  union
  select reschedule_slot_id from public.appointments where lecturer_id = _lecturer and reschedule_slot_id is not null
    and status = 'rescheduling_requested'
$$;
grant execute on function public.booked_slot_ids(uuid) to authenticated;

-- RPC: book
create or replace function public.book_appointment(_slot_id uuid, _purpose text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s record; new_id uuid; sname text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'student') then
    raise exception 'Only students can book appointments.';
  end if;
  if coalesce(length(trim(_purpose)),0) < 5 then raise exception 'Please describe the consultation purpose (at least 5 characters).'; end if;
  select * into s from public.availability_slots where id = _slot_id for update;
  if not found then raise exception 'Slot not found.'; end if;
  if s.lecturer_id = auth.uid() then raise exception 'You cannot book your own slot.'; end if;
  if (s.slot_date + s.start_time) < (now() at time zone 'Asia/Kuala_Lumpur') then raise exception 'This slot is in the past.'; end if;
  if not public.slot_is_free(_slot_id) then raise exception 'Sorry, this slot has just been booked by someone else.'; end if;
  insert into public.appointments(student_id, lecturer_id, slot_id, appointment_date, start_time, end_time, location, purpose, status)
  values (auth.uid(), s.lecturer_id, s.id, s.slot_date, s.start_time, s.end_time,
          case when s.location_type='online' then 'Online: ' || s.location else s.location end, trim(_purpose), 'pending')
  returning id into new_id;
  select full_name into sname from public.profiles where id = auth.uid();
  perform public.notify(s.lecturer_id, 'New appointment request', sname || ' requested a consultation on ' || to_char(s.slot_date,'DD Mon YYYY') || ' at ' || to_char(s.start_time,'HH24:MI') || '.', new_id);
  return new_id;
end $$;
grant execute on function public.book_appointment(uuid,text) to authenticated;

-- RPC: lecturer decide on pending
create or replace function public.decide_appointment(_appt uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.appointments where id = _appt for update;
  if not found or a.lecturer_id <> auth.uid() then raise exception 'Appointment not found.'; end if;
  if a.status <> 'pending' then raise exception 'Only pending requests can be approved or rejected.'; end if;
  if _approve then
    if exists (select 1 from public.appointments x where x.lecturer_id = a.lecturer_id and x.id <> a.id
               and x.appointment_date = a.appointment_date and x.status in ('approved','cancellation_requested','rescheduling_requested')
               and x.start_time < a.end_time and a.start_time < x.end_time) then
      raise exception 'You already have a confirmed appointment overlapping this time.';
    end if;
    update public.appointments set status='approved', lecturer_note=nullif(trim(coalesce(_note,'')),'') where id = _appt;
    perform public.notify(a.student_id, 'Appointment approved', 'Your consultation on ' || to_char(a.appointment_date,'DD Mon YYYY') || ' at ' || to_char(a.start_time,'HH24:MI') || ' has been approved.', _appt);
  else
    update public.appointments set status='rejected', lecturer_note=nullif(trim(coalesce(_note,'')),'') where id = _appt;
    perform public.notify(a.student_id, 'Appointment rejected', 'Your request for ' || to_char(a.appointment_date,'DD Mon YYYY') || ' was rejected.' || coalesce(' Reason: ' || nullif(trim(_note),''), ''), _appt);
  end if;
end $$;
grant execute on function public.decide_appointment(uuid,boolean,text) to authenticated;

-- RPC: student cancel
create or replace function public.request_cancellation(_appt uuid, _reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a record; sname text;
begin
  select * into a from public.appointments where id = _appt for update;
  if not found or a.student_id <> auth.uid() then raise exception 'Appointment not found.'; end if;
  select full_name into sname from public.profiles where id = auth.uid();
  if a.status = 'pending' then
    update public.appointments set status='cancelled', student_request_reason=nullif(trim(coalesce(_reason,'')),'') where id=_appt;
    perform public.notify(a.lecturer_id, 'Request withdrawn', sname || ' withdrew their request for ' || to_char(a.appointment_date,'DD Mon YYYY') || '.', _appt);
    return 'cancelled';
  elsif a.status = 'approved' then
    update public.appointments set status='cancellation_requested', student_request_reason=nullif(trim(coalesce(_reason,'')),'') where id=_appt;
    perform public.notify(a.lecturer_id, 'Cancellation requested', sname || ' requested to cancel the consultation on ' || to_char(a.appointment_date,'DD Mon YYYY') || '.', _appt);
    return 'cancellation_requested';
  else
    raise exception 'This appointment cannot be cancelled in its current status.';
  end if;
end $$;
grant execute on function public.request_cancellation(uuid,text) to authenticated;

-- RPC: student reschedule
create or replace function public.request_reschedule(_appt uuid, _new_slot uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a record; s record; sname text;
begin
  select * into a from public.appointments where id = _appt for update;
  if not found or a.student_id <> auth.uid() then raise exception 'Appointment not found.'; end if;
  if a.status not in ('approved','pending') then raise exception 'Only pending or approved appointments can be rescheduled.'; end if;
  if coalesce(length(trim(_reason)),0) < 3 then raise exception 'Please give a reason for rescheduling.'; end if;
  select * into s from public.availability_slots where id = _new_slot for update;
  if not found or s.lecturer_id <> a.lecturer_id then raise exception 'Please choose a slot from the same lecturer.'; end if;
  if s.id = a.slot_id then raise exception 'Please choose a different slot.'; end if;
  if (s.slot_date + s.start_time) < (now() at time zone 'Asia/Kuala_Lumpur') then raise exception 'This slot is in the past.'; end if;
  if not public.slot_is_free(_new_slot) then raise exception 'That slot is no longer available.'; end if;
  update public.appointments set status='rescheduling_requested', reschedule_slot_id=_new_slot, student_request_reason=trim(_reason), lecturer_note=null where id=_appt;
  select full_name into sname from public.profiles where id = auth.uid();
  perform public.notify(a.lecturer_id, 'Rescheduling requested', sname || ' asked to move their consultation to ' || to_char(s.slot_date,'DD Mon YYYY') || ' at ' || to_char(s.start_time,'HH24:MI') || '.', _appt);
end $$;
grant execute on function public.request_reschedule(uuid,uuid,text) to authenticated;

-- RPC: lecturer respond to cancel/reschedule
create or replace function public.respond_change_request(_appt uuid, _approve boolean, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; s record; new_id uuid;
begin
  select * into a from public.appointments where id = _appt for update;
  if not found or a.lecturer_id <> auth.uid() then raise exception 'Appointment not found.'; end if;
  if a.status = 'cancellation_requested' then
    if _approve then
      update public.appointments set status='cancelled', lecturer_note=nullif(trim(coalesce(_note,'')),'') where id=_appt;
      perform public.notify(a.student_id, 'Cancellation approved', 'Your consultation on ' || to_char(a.appointment_date,'DD Mon YYYY') || ' has been cancelled.', _appt);
    else
      update public.appointments set status='approved', lecturer_note=nullif(trim(coalesce(_note,'')),'') where id=_appt;
      perform public.notify(a.student_id, 'Cancellation declined', 'Your consultation on ' || to_char(a.appointment_date,'DD Mon YYYY') || ' remains scheduled.' || coalesce(' Note: ' || nullif(trim(_note),''), ''), _appt);
    end if;
    return _appt;
  elsif a.status = 'rescheduling_requested' then
    if _approve then
      select * into s from public.availability_slots where id = a.reschedule_slot_id;
      if not found then raise exception 'Requested slot no longer exists.'; end if;
      if exists (select 1 from public.appointments x where x.lecturer_id = a.lecturer_id and x.id <> a.id
                 and x.appointment_date = s.slot_date and x.status in ('approved','cancellation_requested','rescheduling_requested')
                 and x.start_time < s.end_time and s.start_time < x.end_time) then
        raise exception 'You already have a confirmed appointment overlapping the new time.';
      end if;
      update public.appointments set status='cancelled', lecturer_note='Rescheduled to ' || to_char(s.slot_date,'DD Mon YYYY') || ' ' || to_char(s.start_time,'HH24:MI'), reschedule_slot_id = null where id=_appt;
      insert into public.appointments(student_id, lecturer_id, slot_id, appointment_date, start_time, end_time, location, purpose, status, parent_appointment_id, student_request_reason)
      values (a.student_id, a.lecturer_id, s.id, s.slot_date, s.start_time, s.end_time,
              case when s.location_type='online' then 'Online: ' || s.location else s.location end, a.purpose, 'approved', a.id, a.student_request_reason)
      returning id into new_id;
      perform public.notify(a.student_id, 'Rescheduling approved', 'Your consultation has been moved to ' || to_char(s.slot_date,'DD Mon YYYY') || ' at ' || to_char(s.start_time,'HH24:MI') || '.', new_id);
      return new_id;
    else
      update public.appointments set status='approved', reschedule_slot_id=null, lecturer_note=nullif(trim(coalesce(_note,'')),'') where id=_appt;
      perform public.notify(a.student_id, 'Rescheduling declined', 'Your original consultation on ' || to_char(a.appointment_date,'DD Mon YYYY') || ' remains scheduled.' || coalesce(' Note: ' || nullif(trim(_note),''), ''), _appt);
      return _appt;
    end if;
  else
    raise exception 'There is no pending change request for this appointment.';
  end if;
end $$;
grant execute on function public.respond_change_request(uuid,boolean,text) to authenticated;

-- RPC: mark completed
create or replace function public.complete_appointment(_appt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.appointments where id = _appt for update;
  if not found or a.lecturer_id <> auth.uid() then raise exception 'Appointment not found.'; end if;
  if a.status <> 'approved' then raise exception 'Only approved appointments can be marked as completed.'; end if;
  update public.appointments set status='completed' where id=_appt;
end $$;
grant execute on function public.complete_appointment(uuid) to authenticated;

-- Signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.app_role;
begin
  r := case when new.raw_user_meta_data->>'role' = 'lecturer' then 'lecturer'::public.app_role else 'student'::public.app_role end;
  insert into public.profiles(id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  insert into public.user_roles(user_id, role) values (new.id, r);
  if r = 'lecturer' then
    insert into public.lecturers(id, department) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'department',''), 'Department of Software Engineering'));
  else
    insert into public.students(id, matric_no, programme) values (new.id, coalesce(new.raw_user_meta_data->>'matric_no',''), coalesce(new.raw_user_meta_data->>'programme',''));
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
