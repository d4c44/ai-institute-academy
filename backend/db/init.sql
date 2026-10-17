-- One-time setup of the application role and database. Run as the PostgreSQL superuser:
--
--   psql -U postgres -h localhost -v app_password='YOUR_PASSWORD' -f backend/db/init.sql
--
-- Then put the same password into backend/.env:
--   DATABASE_URL=postgres://ai_institute:YOUR_PASSWORD@localhost:5432/ai_institute

CREATE ROLE ai_institute LOGIN PASSWORD :'app_password';
CREATE DATABASE ai_institute OWNER ai_institute ENCODING 'UTF8' TEMPLATE template0;
