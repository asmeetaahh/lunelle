let journals = [];
let nextId = 1;

export function getAllJournals() {
  return journals;
}

export function getJournalById(id) {
  return journals.find((journal) => journal.id === id);
}

export function createJournal(data) {
  const journal = {
    id: nextId++,
    entry: data.entry,
    mood: data.mood ?? null,
    symptoms: data.symptoms ?? [],
    cycleDay: data.cycleDay ?? null,
    cycleLength: data.cycleLength ?? null,
    phase: data.phase ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  journals.push(journal);

  return journal;
}

export function updateJournal(id, data) {
  const journal = getJournalById(id);

  if (!journal) {
    return null;
  }

  if (data.entry !== undefined) journal.entry = data.entry;
  if (data.mood !== undefined) journal.mood = data.mood;
  if (data.symptoms !== undefined) journal.symptoms = data.symptoms;
  if (data.cycleDay !== undefined) journal.cycleDay = data.cycleDay;
  if (data.cycleLength !== undefined) {
    journal.cycleLength = data.cycleLength;
  }
  if (data.phase !== undefined) journal.phase = data.phase;

  journal.updatedAt = new Date().toISOString();

  return journal;
}

export function deleteJournal(id) {
  const index = journals.findIndex((journal) => journal.id === id);

  if (index === -1) {
    return false;
  }

  journals.splice(index, 1);

  return true;
}