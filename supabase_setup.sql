-- Analista José Quipanda — configuração segura do Supabase
-- Execute no Supabase Dashboard > SQL Editor, depois de confirmar as tabelas existentes.
-- Não use uma chave secret/service_role no HTML.

create extension if not exists pgcrypto;

-- Defaults esperados pelo site (não altera os nomes das colunas existentes).
alter table public.profiles alter column role set default 'student';
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();
alter table public.courses alter column price set default 0;
alter table public.courses alter column currency set default 'AOA';
alter table public.courses alter column status set default 'draft';
alter table public.courses alter column created_at set default now();
alter table public.courses alter column updated_at set default now();
alter table public.enrollments alter column status set default 'active';
alter table public.enrollments alter column enrolled_at set default now();
alter table public.certificates alter column issued_at set default now();

-- Cria automaticamente um perfil de estudante após o registo Auth.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role, created_at, updated_at)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Estudante'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'student', now(), now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- updated_at automático para perfis e cursos.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses for each row execute procedure public.set_updated_at();

-- Função auxiliar de autorização, para evitar políticas recursivas em profiles.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

-- Unicidade: não permitir que a mesma conta se inscreva duas vezes no mesmo curso.
create unique index if not exists enrollments_student_course_unique
on public.enrollments (student_id, course_id);
create unique index if not exists certificates_code_unique
on public.certificates (certificate_code);

-- Activar RLS nas quatro tabelas.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.certificates enable row level security;

-- Remover apenas as políticas com os nomes deste script, para permitir reexecução.
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_student on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists courses_read_published_or_admin on public.courses;
drop policy if exists courses_admin_all on public.courses;
drop policy if exists enrollments_read_self_or_admin on public.enrollments;
drop policy if exists enrollments_insert_self_published on public.enrollments;
drop policy if exists enrollments_admin_update on public.enrollments;
drop policy if exists enrollments_admin_delete on public.enrollments;
drop policy if exists certificates_read_self_or_admin on public.certificates;
drop policy if exists certificates_admin_all on public.certificates;

create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_site_admin()));

-- Estudantes só podem actualizar o próprio perfil mantendo role='student'.
create policy profiles_update_self_student on public.profiles
for update to authenticated
using (id = (select auth.uid()) and role = 'student')
with check (id = (select auth.uid()) and role = 'student');

create policy profiles_admin_all on public.profiles
for all to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

create policy courses_read_published_or_admin on public.courses
for select to anon, authenticated
using (status = 'published' or (select auth.uid()) is not null and (select public.is_site_admin()));
create policy courses_admin_all on public.courses
for all to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

create policy enrollments_read_self_or_admin on public.enrollments
for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_site_admin()));
create policy enrollments_insert_self_published on public.enrollments
for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);
create policy enrollments_admin_update on public.enrollments
for update to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));
create policy enrollments_admin_delete on public.enrollments
for delete to authenticated
using ((select public.is_site_admin()));

create policy certificates_read_self_or_admin on public.certificates
for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_site_admin()));
create policy certificates_admin_all on public.certificates
for all to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

-- Verificação pública limitada: não expõe a tabela completa de certificados.
create or replace function public.verify_site_certificate(input_code text)
returns table (certificate_code text, course_title text, student_name text, issued_at timestamptz, revoked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select cert.certificate_code, c.title, p.full_name, cert.issued_at, cert.revoked_at
  from public.certificates cert
  join public.courses c on c.id = cert.course_id
  join public.profiles p on p.id = cert.student_id
  where upper(cert.certificate_code) = upper(trim(input_code))
  limit 1;
$$;
revoke all on function public.verify_site_certificate(text) from public;
grant execute on function public.verify_site_certificate(text) to anon, authenticated;

-- IMPORTANTE: promova manualmente a sua conta a administrador depois de se registar.
-- Substitua o e-mail abaixo pelo e-mail usado no seu registo Auth e execute apenas esta consulta:
-- update public.profiles p set role = 'admin', updated_at = now()
-- from auth.users u where p.id = u.id and lower(u.email) = lower('O-SEU-EMAIL-AQUI');
-- Confirme que exactamente uma linha foi actualizada. Nunca dê permissões admin através do formulário público.
