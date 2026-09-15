function initializePage() {
  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);
  if (typeof updatePendingDocsBadge === 'function') updatePendingDocsBadge();

    if (params.has('member')) {
      const memberId = params.get('member');
    if (memberId) viewDetails(memberId, true);
      else showHome(true);
    return;
  }

    if (params.has('summary')) {
    openSummaryTable(true);
    return;
  }

    if (params.has('documents')) {
      const memberId = params.get('documents');
      if (memberId) openDocsView(memberId, true, params.get('docType'), params.get('folder'));
      else showHome(true);
    return;
  }

  if (params.has('consolidated')) {
    openConsolidatedView({ skipHistory: true, filter: params.get('filter') });
    return;
  }

  if (params.has('edit')) {
    const member = members.find(item => String(item.id) === params.get('edit'));
    if (member) {
      openForm(member, true);
      return;
    }
  }

  renderGrid();
}

  function navigateApp(view, data = {}) {
    const params = new URLSearchParams();
    let state = { app: 'family', view };
    if (view === 'member') {
      params.set('member', data.id);
      state.memberId = data.id;
    } else if (view === 'summary') {
      params.set('summary', '1');
    } else if (view === 'documents') {
      params.set('documents', data.id);
      state.memberId = data.id;
      if (data.docType) { params.set('docType', data.docType); state.docType = data.docType; }
      if (data.folder) { params.set('folder', data.folder); state.folder = data.folder; }
    } else if (view === 'consolidated') {
      params.set('consolidated', '1');
      if (data.filter) {
        params.set('filter', data.filter);
        state.filter = data.filter;
      }
    } else if (view === 'form') {
      params.set('edit', data.id);
      state.memberId = data.id;
    }
    const query = params.toString();
    history.pushState(state, '', `index.html${query ? `?${query}` : ''}`);
    if (view === 'member') viewDetails(data.id, true);
    else if (view === 'summary') openSummaryTable(true);
    else if (view === 'documents') openDocsView(data.id, true, data.docType || null, data.folder || null);
    else if (view === 'consolidated') openConsolidatedView({ skipHistory: true, filter: data.filter || null });
    else if (view === 'form') openForm(members.find(item => String(item.id) === String(data.id)), true);
    else showHome(true);
  }

function editMemberFromPage() {
  if (currentMemberId) navigateApp('form', { id: currentMemberId });
}

if (typeof masterPassword === 'string' && document.getElementById('appScreen') && !document.getElementById('appScreen').classList.contains('hidden')) {
  initializePage();
}