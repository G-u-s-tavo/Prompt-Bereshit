export function snapshotSpecification(project) {
  return {
    version:project.specVersion || 1,
    approved: false,
    createdAt:new Date().toISOString(),
    requirements:structuredClone(project.requirements || []),
    brief:structuredClone(project.brief || {}),
    improvement:structuredClone(project.improvement || {}),
    context:structuredClone(project.context || []),
    resolutions:structuredClone(project.resolutions || {})
  };
}

export function invalidateSpecification(project, reason = 'A especificação foi alterada.') {
  project.specVersion = Math.max(1, Number(project.specVersion) || 1) + 1;
  project.approved = false;
  project.approvedSpecVersion = null;
  project.prompts ||= { discovery:'', execution:'' };
  project.prompts.execution = '';
  project.specHistory ||= [];
  project.specHistory.unshift({ ...snapshotSpecification(project), reason, approved:false });
  project.specHistory = project.specHistory.slice(0, 30);
  project.specChangedAt = new Date().toISOString();
}

export function approveSpecification(project) {
  project.approved = true;
  project.approvedSpecVersion = project.specVersion || 1;
  project.approvalHistory ||= [];
  project.approvalHistory.unshift({ version:project.approvedSpecVersion, approvedAt:new Date().toISOString() });
  project.approvalHistory = project.approvalHistory.slice(0,30);
  project.specHistory ||= [];
  project.specHistory.unshift({ ...snapshotSpecification(project), approved:true, approvedAt:new Date().toISOString() });
  project.specHistory = project.specHistory.slice(0,30);
}

export function isSpecificationApproved(project) {
  return Boolean(project?.approved && project.approvedSpecVersion === (project.specVersion || 1));
}

export function buildTextDiff(before = '', after = '') {
  const oldLines = String(before).split('\n');
  const newLines = String(after).split('\n');
  // LCS uses O(n*m) memory. Keep comparisons predictable for very large prompts.
  const MAX_CELLS = 60_000;
  if (oldLines.length * newLines.length > MAX_CELLS) {
    let prefix = 0;
    while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
    let oldTail = oldLines.length - 1;
    let newTail = newLines.length - 1;
    while (oldTail >= prefix && newTail >= prefix && oldLines[oldTail] === newLines[newTail]) { oldTail--; newTail--; }
    const diff = oldLines.slice(0, prefix).map(text => ({type:'same', text}));
    diff.push({type:'removed', text:`[Trecho anterior omitido na comparação: ${Math.max(0, oldTail-prefix+1)} linhas]`});
    diff.push({type:'added', text:`[Trecho atual omitido na comparação: ${Math.max(0, newTail-prefix+1)} linhas]`});
    diff.push(...oldLines.slice(oldTail + 1).map(text => ({type:'same', text})));
    return diff;
  }
  const matrix = Array.from({ length:oldLines.length + 1 },()=>Array(newLines.length + 1).fill(0));
  for (let i=oldLines.length-1;i>=0;i--) for (let j=newLines.length-1;j>=0;j--) matrix[i][j] = oldLines[i] === newLines[j] ? matrix[i+1][j+1] + 1 : Math.max(matrix[i+1][j],matrix[i][j+1]);
  const diff=[]; let i=0,j=0;
  while(i<oldLines.length && j<newLines.length) {
    if(oldLines[i]===newLines[j]) { diff.push({type:'same',text:oldLines[i++]}); j++; }
    else if(matrix[i+1][j]>=matrix[i][j+1]) diff.push({type:'removed',text:oldLines[i++]});
    else diff.push({type:'added',text:newLines[j++]});
  }
  while(i<oldLines.length) diff.push({type:'removed',text:oldLines[i++]});
  while(j<newLines.length) diff.push({type:'added',text:newLines[j++]});
  return diff;
}
