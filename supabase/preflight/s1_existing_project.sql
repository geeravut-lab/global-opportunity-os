-- อ่าน metadata เท่านั้น ไม่อ่านข้อมูลบุคคลหรือเปลี่ยน schema/roles/settings
begin read only;
-- หากมี app/private หรือ public.goos_* อยู่แล้ว ต้องตรวจเจ้าของและความเข้ากันได้ก่อนใช้ migrations
select n.nspname as schema_name,c.relname as object_name,c.relkind
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('app','private') order by 1,2;
select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 r.rolname as owner,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname in ('public','private') and p.proname like 'goos_%' order by 1,2;
-- role ชื่อเดียวกันที่มี superuser/BYPASSRLS/login/inheritance ไม่ใช่ app roles ที่ migration ออกแบบไว้
select rolname,rolsuper,rolbypassrls,rolcanlogin,rolinherit
from pg_roles where rolname in ('goos_api','goos_authz');
-- ต้องมี Auth metadata ที่ predicate ใช้และ operator อ่านได้
select table_name,column_name
from information_schema.columns
where table_schema='auth' and (
 (table_name='users' and column_name in ('id','email_confirmed_at','is_anonymous')) or
 (table_name='sessions' and column_name in ('id','user_id')) or
 (table_name='mfa_factors' and column_name in ('user_id','status')))
order by 1,2;
select current_user as migration_operator,
 has_table_privilege(current_user,'auth.users','select') as reads_auth_users,
 has_table_privilege(current_user,'auth.sessions','select') as reads_auth_sessions,
 has_table_privilege(current_user,'auth.mfa_factors','select') as reads_auth_factors;
-- รายงานการมี migration history เท่านั้น ไม่สมมติว่าตารางนี้มีอยู่ในทุก Project
select to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_history;
commit;
