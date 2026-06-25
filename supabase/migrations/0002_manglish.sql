-- Add the Manglish flag to dictionary entries.
-- Manglish = romanized Malayalam (Latin letters); the app matches these
-- forgivingly (case/punctuation/length-insensitive). Run once in the SQL Editor.

alter table public.dictionary_entries
  add column if not exists manglish boolean not null default false;
