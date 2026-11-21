/** @typedef {{ projects: object[], activeProjectId: string|null, globalNotes: object[], schemaVersion: number }} Workspace */
export const WORKSPACE_KEY = 'prompt-bereshit-workspace-v2';
export const LEGACY_WORKSPACE_KEYS = ['prompt-bereshit-workspace-v1'];
export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
export const MAX_PROJECTS_PER_IMPORT = 250;

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asString = (value, max = 200000) => typeof value === 'string' ? value.slice(0, max) : '';

export function normalizeProject(project, index = 0, queueBuilder = null) {
  const source = asObject(project);
  const brief = asObject(source.brief);
  const normalized = {
    ...source,
    id: asString(source.id, 160) || `imported-${Date.now()}-${index}`,
    workflowType: source.workflowType === 'improve' ? 'improve' : 'create',
    depth: ['brief', 'standard', 'comprehensive'].includes(source.depth) ? source.depth : 'standard',
    moduleId: asString(source.moduleId, 100) || 'web-development',
    brief: Object.fromEntries(['title','idea','goal','audience','deliverable','constraints'].map((key) => [key, asString(brief[key], key === 'idea' ? 30000 : 10000)])),
    answers: asArray(source.answers).slice(0, 150).map((answer) => ({ id:asString(answer?.id,160), value:asString(answer?.value,10000), delegate:Boolean(answer?.delegate) })),
    requirements: asArray(source.requirements).slice(0, 500).map((requirement) => ({
      id:asString(requirement?.id,160), category:asString(requirement?.category,120), description:asString(requirement?.description,10000),
      classification:asString(requirement?.classification,80) || 'explicit', priority:({P0:'critical',P1:'high',P2:'medium',P3:'low'})[requirement?.priority] || (['critical','high','medium','low'].includes(requirement?.priority) ? requirement.priority : 'high'),
      dependencies:asArray(requirement?.dependencies).map((item)=>asString(item,160)).slice(0,50),
      source:asObject(requirement?.source), criteria:asString(requirement?.criteria,5000), status:asString(requirement?.status,40) || 'active'
    })),
    context:asArray(source.context).slice(0,300).map((note)=>({
      id:asString(note?.id,160), title:asString(note?.title,300), body:asString(note?.body,20000), pinned:Boolean(note?.pinned),
      kind:asString(note?.kind,60) || 'note', source:asString(note?.source,300), createdAt:asString(note?.createdAt,80) || new Date().toISOString()
    })),
    refinements:asArray(source.refinements).slice(0,100).map((item)=>typeof item==='string'?asString(item,10000):({id:asString(item?.id,160),type:item?.type==='discovery'?'discovery':'execution',note:asString(item?.note,10000),createdAt:asString(item?.createdAt,80)})),
    decisions:asArray(source.decisions).map((item)=>asString(item,5000)).slice(0,100),
    assumptions:asArray(source.assumptions).map((item)=>asString(item,5000)).slice(0,100),
    assets:asArray(source.assets).slice(0,80).map((asset)=>({
      id:asString(asset?.id,160), name:asString(asset?.name,300), type:asString(asset?.type,120), size:Number(asset?.size)||0,
      text:asString(asset?.text,180000), extracted:Boolean(asset?.extracted), note:asString(asset?.note,1000), createdAt:asString(asset?.createdAt,80)
    })),
    improvement: (() => {
      const value = asObject(source.improvement);
      return {
        level:['quickfix','refinement','overhaul'].includes(value.level) ? value.level : 'refinement',
        categories:asArray(value.categories).map((item)=>asString(item,80)).filter(Boolean).slice(0,30),
        currentState:asString(value.currentState,30000), goal:asString(value.goal,20000),
        preserve:asString(value.preserve,20000), modify:asString(value.modify,20000),
        expand:asString(value.expand,20000), remove:asString(value.remove,20000),
        restrictions:asString(value.restrictions,20000)
      };
    })(),
    improvementAnalysis: (() => { const value=asObject(source.improvementAnalysis); return {
      level:asString(value.level,40), findings:asArray(value.findings).slice(0,100).map((item)=>({severity:asString(item?.severity,20),title:asString(item?.title,300),detail:asString(item?.detail,5000),evidence:asString(item?.evidence,5000)})),
      risks:asArray(value.risks).map((item)=>asString(item,3000)).slice(0,100),
      inspected:asArray(value.inspected).map((item)=>asString(item,300)).slice(0,100),
      limitations:asArray(value.limitations).map((item)=>asString(item,2000)).slice(0,100)
    }; })(),
    prompts:{ discovery:asString(source.prompts?.discovery,500000), execution:asString(source.prompts?.execution,500000) },
    promptHistory:asArray(source.promptHistory).slice(0,100).map((item)=>({
      id:asString(item?.id,160), type:asString(item?.type,40), content:asString(item?.content,500000), createdAt:asString(item?.createdAt,80), specVersion:Number(item?.specVersion)||1, note:asString(item?.note,1000)
    })),
    specVersion:Math.max(1, Number(source.specVersion)||1), approvedSpecVersion:Number(source.approvedSpecVersion)||(source.approved ? Math.max(1, Number(source.specVersion)||1) : null),
    specHistory:asArray(source.specHistory).slice(0,50).map((item)=>({version:Number(item?.version)||1,createdAt:asString(item?.createdAt,80),approved:Boolean(item?.approved),reason:asString(item?.reason,1000),requirements:asArray(item?.requirements).slice(0,500),brief:asObject(item?.brief),improvement:asObject(item?.improvement),context:asArray(item?.context).slice(0,300),resolutions:asObject(item?.resolutions)})),
    approvalHistory:asArray(source.approvalHistory).slice(0,30).map((item)=>({version:Number(item?.version)||1,approvedAt:asString(item?.approvedAt,80)})),
    promptSpecVersions:asObject(source.promptSpecVersions), questionRegistry:asArray(source.questionRegistry).slice(0,60).map((q)=>({id:asString(q?.id,160),group:asString(q?.group,120),title:asString(q?.title,300),question:asString(q?.question,3000),placeholder:asString(q?.placeholder,2000)})),
    resolutions:Object.fromEntries(Object.entries(asObject(source.resolutions)).slice(0,100).map(([key,value])=>[asString(key,160),asString(value,2000)])),
    createdAt:asString(source.createdAt,80) || new Date().toISOString(), updatedAt:asString(source.updatedAt,80) || new Date().toISOString()
  };
  normalized.approved = Boolean(source.approved) && normalized.approvedSpecVersion === normalized.specVersion;
  if (queueBuilder) {
    const queue = queueBuilder(normalized);
    normalized.answers = normalized.answers.map((answer, answerIndex) => ({ ...answer, id:answer.id || queue[answerIndex]?.id || `legacy-question-${answerIndex}` }));
  }
  return normalized;
}

export function normalizeWorkspace(raw, queueBuilder = null) {
  const incoming = asObject(raw);
  const projects = asArray(incoming.projects).slice(0, MAX_PROJECTS_PER_IMPORT).map((project, index)=>normalizeProject(project,index,queueBuilder));
  return {
    schemaVersion:2,
    projects,
    activeProjectId:projects.some((project)=>project.id === incoming.activeProjectId) ? incoming.activeProjectId : projects[0]?.id || null,
    globalNotes:asArray(incoming.globalNotes).slice(0,500).map((note)=>({ title:asString(note?.title,300), body:asString(note?.body,10000), createdAt:asString(note?.createdAt,80) }))
  };
}

export function validateImportPayload(raw, byteLength = 0) {
  if (byteLength > MAX_IMPORT_BYTES) throw new Error('O arquivo ultrapassa o limite de 12 MB.');
  const payload = asObject(raw);
  if (!Array.isArray(payload.projects)) throw new Error('Backup inválido: a lista de projetos não foi encontrada.');
  if (payload.projects.length > MAX_PROJECTS_PER_IMPORT) throw new Error(`O backup excede o limite de ${MAX_PROJECTS_PER_IMPORT} projetos.`);
  for (const [index, project] of payload.projects.entries()) {
    if (!project || typeof project !== 'object' || Array.isArray(project) || typeof project.brief !== 'object' || Array.isArray(project.brief) || !project.brief) {
      throw new Error(`O projeto na posição ${index + 1} não possui uma estrutura reconhecível.`);
    }
    if (JSON.stringify(project).length > 2_000_000) throw new Error(`O projeto na posição ${index + 1} é muito grande para importar com segurança.`);
  }
  return payload;
}

export function mergeWorkspaces(current, incoming, idFactory, queueBuilder = null) {
  const merged = structuredClone(current);
  const ids = new Set(merged.projects.map((project)=>project.id));
  const imported = normalizeWorkspace(incoming, queueBuilder).projects;
  for (const project of imported) {
    if (ids.has(project.id)) project.id = idFactory();
    ids.add(project.id);
    merged.projects.push(project);
  }
  merged.globalNotes = [...asArray(merged.globalNotes), ...asArray(incoming.globalNotes)].slice(0,500).map((note)=>({title:asString(note?.title,300),body:asString(note?.body,10000),createdAt:asString(note?.createdAt,80)}));
  merged.schemaVersion = 2;
  return merged;
}
