const STORAGE_KEY = 'legalsafe_g_doc_history';

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read history from localStorage:', err);
    return [];
  }
}

export function saveHistoryItem(result) {
  if (!result || !result.result_id) return;
  try {
    const history = getHistory();
    const existingIdx = history.findIndex(item => item.result_id === result.result_id);
    
    const newItem = {
      result_id: result.result_id,
      document_id: result.document_id,
      filename: result.filename || 'Legal_Document.pdf',
      mode: result.mode || 'constrained',
      clause_count: result.clauses ? result.clauses.length : 0,
      verification_summary: result.verification_summary || {},
      created_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      history[existingIdx] = newItem;
    } else {
      history.unshift(newItem); // newest first
    }

    // Cap at 20 items
    const trimmed = history.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save history item:', err);
  }
}

export function removeHistoryItem(resultId) {
  try {
    const history = getHistory();
    const filtered = history.filter(item => item.result_id !== resultId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove history item:', err);
  }
}
