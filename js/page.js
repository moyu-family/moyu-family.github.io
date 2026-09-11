function initializePage() {
  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);

  if (page === 'member') {
    const memberId = params.get('id');
    if (memberId) viewDetails(memberId, true);
    else window.location.href = 'index.html';
    return;
  }

  if (page === 'summary') {
    const selected = params.get('ids');
    if (selected) selected.split(',').filter(Boolean).forEach(id => selectedIds.add(id));
    openSummaryTable(true);
    return;
  }

  if (page === 'documents') {
    const memberId = params.get('id');
    if (memberId) {
      const backLink = document.getElementById('docsBackLink');
      if (backLink) backLink.href = `member.html?id=${encodeURIComponent(memberId)}`;
      openDocsView(memberId, true);
    }
    else window.location.href = 'index.html';
    return;
  }

  renderGrid();
  if (params.get('edit')) {
    const member = members.find(item => item.id === params.get('edit'));
    if (member) openForm(member, true);
  }
}

function editMemberFromPage() {
  if (currentMemberId) window.location.href = `index.html?edit=${encodeURIComponent(currentMemberId)}`;
}