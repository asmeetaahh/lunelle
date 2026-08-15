import { supabase } from "./supabase.js";

function formatJournal(journal) {
  if (!journal) {
    return null
  }

  return {
    id: journal.id,
    title: journal.title ?? '',
    entry: journal.entry,
    mood: journal.mood,
    symptoms: journal.symptoms ?? [],
    cycleDay: journal.cycle_day,
    cycleLength: journal.cycle_length,
    phase: journal.phase,
    createdAt: journal.created_at,
    updatedAt: journal.updated_at,
  }
}

export async function getAllJournals() {
  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(formatJournal);
}

export async function getJournalById(id) {
  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return formatJournal(data);
}

export async function createJournal(data) {
  const { data: journal, error } = await supabase
    .from("journals")
    .insert({
    title: data.title ?? '',
    entry: data.entry,
    mood: data.mood ?? null,
    symptoms: data.symptoms ?? [],
    cycle_day: data.cycleDay ?? null,
    cycle_length: data.cycleLength ?? null,
    phase: data.phase ?? null,
  })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return formatJournal(journal);
}

export async function updateJournal(id, data) {
  const updates = {};
  
  if (data.title !== undefined) {
  updates.title = data.title
  }

  if (data.entry !== undefined) {
    updates.entry = data.entry;
  }

  if (data.mood !== undefined) {
    updates.mood = data.mood;
  }

  if (data.symptoms !== undefined) {
    updates.symptoms = data.symptoms;
  }

  if (data.cycleDay !== undefined) {
    updates.cycle_day = data.cycleDay;
  }

  if (data.cycleLength !== undefined) {
    updates.cycle_length = data.cycleLength;
  }

  if (data.phase !== undefined) {
    updates.phase = data.phase;
  }

  const { data: journal, error } = await supabase
    .from("journals")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return formatJournal(journal);
}

export async function deleteJournal(id) {
  const { data, error } = await supabase
    .from("journals")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}