-- =============================================================
-- Dreamlab Canvas — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles (auto-created on signup)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon JSONB NOT NULL DEFAULT '{"type":"letter","value":"D"}',
    intelligence_level TEXT NOT NULL DEFAULT 'quick',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects (Project Folders)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Collections
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    sort_order BIGINT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'custom',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure existing installs gain project_id + FK (idempotent)
ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS project_id UUID;

ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS sort_order BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'collections_project_id_fkey'
    ) THEN
        ALTER TABLE collections
            ADD CONSTRAINT collections_project_id_fkey
            FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

-- 6. Items
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    sort_order BIGINT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    description TEXT,
    source_url TEXT,
    content_storage TEXT,
    thumbnail TEXT,
    thumbnail_storage TEXT,
    objective_tags TEXT[] DEFAULT '{}',
    context_tags JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    intelligence_level TEXT,
    needs_tagging BOOLEAN DEFAULT FALSE,
    link_view_mode TEXT,
    link_embed JSONB,
    text_extract JSONB,
    metadata JSONB,
    canvas JSONB,
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS sort_order BIGINT;

-- 7. Primitive Analysis Cache
CREATE TABLE IF NOT EXISTS primitive_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_id UUID REFERENCES items(id) ON DELETE CASCADE,
    image_hash TEXT NOT NULL,
    primitives JSONB NOT NULL DEFAULT '{}',
    lenses JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, image_hash)
);

-- 8. Active Context (last selected workspace/collection per user)
CREATE TABLE IF NOT EXISTS active_contexts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collections_project ON collections(project_id);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_workspace ON items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id);
CREATE INDEX IF NOT EXISTS idx_items_collection_sort ON items(collection_id, sort_order DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_tags ON items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_primitive_hash ON primitive_analysis(user_id, image_hash);

-- =============================================================
-- Row Level Security
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE primitive_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_contexts ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces
CREATE POLICY "Users can view own workspaces" ON workspaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workspaces" ON workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workspaces" ON workspaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workspaces" ON workspaces FOR DELETE USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Collections
CREATE POLICY "Users can view own collections" ON collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own collections" ON collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON collections FOR DELETE USING (auth.uid() = user_id);

-- Items
CREATE POLICY "Users can view own items" ON items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own items" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON items FOR DELETE USING (auth.uid() = user_id);

-- Primitive Analysis
CREATE POLICY "Users can view own analysis" ON primitive_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own analysis" ON primitive_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analysis" ON primitive_analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own analysis" ON primitive_analysis FOR DELETE USING (auth.uid() = user_id);

-- Active Contexts
CREATE POLICY "Users can view own context" ON active_contexts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own context" ON active_contexts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON active_contexts FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================
-- Project Folder Backfill (idempotent)
-- =============================================================

-- Create a default "General" project for each workspace if it does not exist.
INSERT INTO projects (user_id, workspace_id, name)
SELECT w.user_id, w.id, 'General'
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.workspace_id = w.id
      AND LOWER(p.name) = 'general'
);

-- Assign legacy collections with NULL project_id into the workspace's General project.
WITH general_projects AS (
    SELECT DISTINCT ON (workspace_id)
        workspace_id,
        id
    FROM projects
    WHERE LOWER(name) = 'general'
    ORDER BY workspace_id, created_at ASC, id ASC
)
UPDATE collections c
SET project_id = gp.id
FROM general_projects gp
WHERE c.project_id IS NULL
  AND c.workspace_id IS NOT NULL
  AND c.workspace_id = gp.workspace_id;

-- Backfill collection sort order within each workspace/project
WITH ordered_collections AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY workspace_id, project_id
            ORDER BY created_at ASC, id ASC
        ) AS sort_rank
    FROM collections
)
UPDATE collections c
SET sort_order = ordered_collections.sort_rank * 1000
FROM ordered_collections
WHERE c.id = ordered_collections.id
  AND c.sort_order IS NULL;

-- Backfill item sort order within each collection.
-- Existing visual default is newest-first (created_at DESC, id DESC).
WITH ordered_items AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY collection_id
            ORDER BY created_at DESC, id DESC
        ) AS sort_rank
    FROM items
    WHERE collection_id IS NOT NULL
)
UPDATE items i
SET sort_order = ordered_items.sort_rank * 1000
FROM ordered_items
WHERE i.id = ordered_items.id
  AND i.sort_order IS NULL;

-- =============================================================
-- Triggers
-- =============================================================

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_ts BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_ts BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_ts BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_ts BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- Storage Bucket (run separately in Storage settings, or via SQL)
-- =============================================================
CREATE POLICY "Users can upload own media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'dreamlab-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own media"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'dreamlab-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'dreamlab-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================================
-- Invite Codes (closed alpha)
-- =============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
-- No direct access policies — table is fully locked down.
-- All access goes through SECURITY DEFINER functions below.

-- Check if a code is valid (callable by anyone, including unauthenticated users)
CREATE OR REPLACE FUNCTION check_invite_code(invite_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM invite_codes WHERE code = invite_code AND used_by IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically claim a code after signup succeeds
CREATE OR REPLACE FUNCTION claim_invite_code(invite_code TEXT, claiming_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    found_id UUID;
BEGIN
    UPDATE invite_codes
    SET used_by = claiming_user_id, used_at = NOW()
    WHERE code = invite_code AND used_by IS NULL
    RETURNING id INTO found_id;

    RETURN found_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
