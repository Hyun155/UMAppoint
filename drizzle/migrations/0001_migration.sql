
do $$
declare
  pw text := extensions.crypt('Demo@1234', extensions.gen_salt('bf'));
  u record;
begin
  for u in select * from (values
    ('a0000000-0000-0000-0000-000000000001'::uuid,'nurul.hakim@demo.umappoint.edu','Nurul Hakimah binti Azman','lecturer'),
    ('a0000000-0000-0000-0000-000000000002'::uuid,'daniel.tan@demo.umappoint.edu','Daniel Tan Wei Ming','lecturer'),
    ('a0000000-0000-0000-0000-000000000003'::uuid,'priya.nair@demo.umappoint.edu','Priya Devi Nair','lecturer'),
    ('a0000000-0000-0000-0000-000000000004'::uuid,'farid.ismail@demo.umappoint.edu','Ahmad Farid bin Ismail','lecturer'),
    ('a0000000-0000-0000-0000-000000000005'::uuid,'grace.lim@demo.umappoint.edu','Grace Lim Siew Ling','lecturer'),
    ('b0000000-0000-0000-0000-000000000001'::uuid,'aiman.student@demo.umappoint.edu','Muhammad Aiman bin Rosli','student'),
    ('b0000000-0000-0000-0000-000000000002'::uuid,'chloe.student@demo.umappoint.edu','Chloe Wong Jia Yi','student'),
    ('b0000000-0000-0000-0000-000000000003'::uuid,'arjun.student@demo.umappoint.edu','Arjun Kumar a/l Suresh','student'),
    ('b0000000-0000-0000-0000-000000000004'::uuid,'siti.student@demo.umappoint.edu','Siti Aisyah binti Kamal','student'),
    ('b0000000-0000-0000-0000-000000000005'::uuid,'jason.student@demo.umappoint.edu','Jason Lee Kah Hoe','student'),
    ('b0000000-0000-0000-0000-000000000006'::uuid,'nadia.student@demo.umappoint.edu','Nadia Farhana binti Yusof','student'),
    ('b0000000-0000-0000-0000-000000000007'::uuid,'kevin.student@demo.umappoint.edu','Kevin Ong Zhi Hao','student'),
    ('b0000000-0000-0000-0000-000000000008'::uuid,'meera.student@demo.umappoint.edu','Meera Lakshmi','student'),
    ('b0000000-0000-0000-0000-000000000009'::uuid,'haziq.student@demo.umappoint.edu','Haziq Danial bin Omar','student'),
    ('b0000000-0000-0000-0000-000000000010'::uuid,'emily.student@demo.umappoint.edu','Emily Chan Hui Min','student')
  ) as t(id,email,name,role) loop
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,pw,now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name',u.name,'role',u.role),now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now());
  end loop;
end $$;

update public.lecturers l set title=v.title, department=v.dept, specialization=v.spec, office_location=v.office, consultation_info=v.info
from (values
 ('a0000000-0000-0000-0000-000000000001'::uuid,'Assoc. Prof. Dr.','Department of Artificial Intelligence','Machine Learning, Natural Language Processing, Malay NLP','Block A, Level 3, Room A3-12','Available for FYP supervision and ML coursework queries. Please bring your draft or code.'),
 ('a0000000-0000-0000-0000-000000000002'::uuid,'Dr.','Department of Software Engineering','Software Architecture, Agile Methods, DevOps','Block B, Level 2, Room B2-05','Consultations on WIA2005 group projects and software design reviews.'),
 ('a0000000-0000-0000-0000-000000000003'::uuid,'Prof. Dr.','Department of Computer System & Technology','Computer Networks, IoT, Cybersecurity','Block C, Level 1, Room C1-08','Academic advising and network security research discussions.'),
 ('a0000000-0000-0000-0000-000000000004'::uuid,'Dr.','Department of Information Systems','Data Analytics, Information Systems Strategy, E-Government','Block A, Level 2, Room A2-19','Advisor for Information Systems students. Course planning and internships.'),
 ('a0000000-0000-0000-0000-000000000005'::uuid,'Ts. Dr.','Department of Multimedia Computing','Human-Computer Interaction, UX Design, Computer Graphics','Block B, Level 4, Room B4-02','UX/HCI project consultations. Online sessions via Google Meet available.')
) as v(id,title,dept,spec,office,info) where l.id=v.id;

update public.students s set matric_no=v.m, programme=v.p, year_of_study=v.y from (values
 ('b0000000-0000-0000-0000-000000000001'::uuid,'U2102345','Bachelor of Computer Science (Software Engineering)',3),
 ('b0000000-0000-0000-0000-000000000002'::uuid,'U2103456','Bachelor of Computer Science (Artificial Intelligence)',2),
 ('b0000000-0000-0000-0000-000000000003'::uuid,'U2104567','Bachelor of Computer Science (Computer System & Network)',4),
 ('b0000000-0000-0000-0000-000000000004'::uuid,'U2105678','Bachelor of Computer Science (Information Systems)',1),
 ('b0000000-0000-0000-0000-000000000005'::uuid,'U2106789','Bachelor of Computer Science (Multimedia)',3),
 ('b0000000-0000-0000-0000-000000000006'::uuid,'U2107890','Bachelor of Computer Science (Software Engineering)',2),
 ('b0000000-0000-0000-0000-000000000007'::uuid,'U2108901','Bachelor of Computer Science (Artificial Intelligence)',4),
 ('b0000000-0000-0000-0000-000000000008'::uuid,'U2109012','Bachelor of Computer Science (Data Science)',1),
 ('b0000000-0000-0000-0000-000000000009'::uuid,'U2100123','Bachelor of Computer Science (Information Systems)',3),
 ('b0000000-0000-0000-0000-000000000010'::uuid,'U2101234','Bachelor of Computer Science (Multimedia)',2)
) as v(id,m,p,y) where s.id=v.id;

-- Slots: next 14 days on weekdays for each lecturer, plus past slots for history
insert into public.availability_slots(lecturer_id, slot_date, start_time, end_time, location_type, location, notes)
select l.id, d::date, t.st, t.st + interval '30 minutes',
  case when (extract(day from d)::int + t.n) % 3 = 0 then 'online' else 'physical' end,
  case when (extract(day from d)::int + t.n) % 3 = 0 then 'Google Meet (link shared after approval)' else l.office_location end,
  null
from public.lecturers l
cross join generate_series(current_date - 10, current_date + 14, interval '1 day') d
cross join (values (time '10:00',1),(time '14:30',2),(time '16:00',3)) t(st,n)
where extract(isodow from d) between 1 and 5
  and (abs(hashtext(l.id::text || d::text || t.st::text)) % 3) <> 0;

-- Appointments
do $$
declare
  st uuid[] := array(select id from public.students order by id);
  sl record; i int := 0; s_id uuid; stat public.appointment_status;
  purposes text[] := array['Discuss FYP proposal scope and methodology','Clarification on assignment 2 requirements','Feedback on mid-semester test results','Course registration advice for next semester','Review of system design diagrams','Internship placement and recommendation letter','Help with research paper literature review','Questions about lab exercise on neural networks'];
begin
  -- past slots: completed / cancelled / rejected
  for sl in select * from public.availability_slots where slot_date < current_date order by slot_date, start_time limit 14 loop
    i := i + 1; s_id := st[1 + (i % 10)];
    stat := (array['completed','completed','completed','rejected','cancelled'])[1 + (i % 5)]::public.appointment_status;
    insert into public.appointments(student_id, lecturer_id, slot_id, appointment_date, start_time, end_time, location, purpose, status, lecturer_note, created_at)
    values (s_id, sl.lecturer_id, sl.id, sl.slot_date, sl.start_time, sl.end_time, sl.location, purposes[1 + (i % 8)], stat,
      case when stat='rejected' then 'I am attending a faculty meeting at this time, please book another slot.' end, sl.slot_date - 3);
  end loop;
  -- future: approved / pending / rejected / cancellation_requested
  i := 0;
  for sl in select * from public.availability_slots where slot_date > current_date order by slot_date, start_time, lecturer_id limit 18 loop
    i := i + 1; s_id := st[1 + (i % 10)];
    stat := (array['pending','approved','pending','approved','rejected','approved','cancelled','pending','cancellation_requested'])[1 + (i % 9)]::public.appointment_status;
    insert into public.appointments(student_id, lecturer_id, slot_id, appointment_date, start_time, end_time, location, purpose, status, lecturer_note, student_request_reason, created_at)
    values (s_id, sl.lecturer_id, sl.id, sl.slot_date, sl.start_time, sl.end_time, sl.location, purposes[1 + (i % 8)], stat,
      case when stat='rejected' then 'Please consult your tutor first for this topic.' end,
      case when stat='cancellation_requested' then 'I have a clashing class replacement.' end, now() - interval '1 day');
  end loop;
end $$;

-- Sample notifications
insert into public.notifications(user_id, title, message, appointment_id, is_read, created_at)
select a.student_id,
  case a.status when 'approved' then 'Appointment approved' when 'rejected' then 'Appointment rejected' when 'cancelled' then 'Appointment cancelled' else 'Consultation completed' end,
  'Your consultation with ' || p.full_name || ' on ' || to_char(a.appointment_date,'DD Mon YYYY') || ' is now ' || replace(a.status::text,'_',' ') || '.',
  a.id, a.appointment_date < current_date, now() - interval '12 hours'
from public.appointments a join public.profiles p on p.id = a.lecturer_id
where a.status in ('approved','rejected','cancelled','completed');

insert into public.notifications(user_id, title, message, appointment_id, is_read, created_at)
select a.lecturer_id,
  case a.status when 'pending' then 'New appointment request' else 'Cancellation requested' end,
  p.full_name || case a.status when 'pending' then ' requested a consultation on ' else ' requested to cancel the consultation on ' end || to_char(a.appointment_date,'DD Mon YYYY') || '.',
  a.id, false, now() - interval '20 hours'
from public.appointments a join public.profiles p on p.id = a.student_id
where a.status in ('pending','cancellation_requested');
