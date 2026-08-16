/**
 * zh / en dictionaries for the PiHuo Workers settings section and tool card.
 * Keys must stay in lockstep; `locales.test.ts` checks that.
 */

export const NS = 'pihuo.workers'

export type WorkersKey =
  | 'nav'
  | 'team'
  | 'teamIntro'
  | 'teamEmpty'
  | 'teamAssign'
  | 'teamRole'
  | 'roleGeneral'
  | 'roleCoder'
  | 'roleReview'
  | 'roleResearch'
  | 'title'
  | 'listIntro'
  | 'empty'
  | 'addFromCatalog'
  | 'addCustom'
  | 'refresh'
  | 'refreshing'
  | 'refreshOk'
  | 'refreshFail'
  | 'fieldAuthors'
  | 'fieldRepo'
  | 'fieldSite'
  | 'search'
  | 'searchPlaceholder'
  | 'advanced'
  | 'advancedHide'
  | 'confirmDelete'
  | 'commandLine'
  | 'closeEditor'
  | 'discard'
  | 'catalogIntro'
  | 'catalogLoading'
  | 'catalogSourceLive'
  | 'catalogSourceLkg'
  | 'catalogSourceBundled'
  | 'catalogCount'
  | 'distNpx'
  | 'distUvx'
  | 'distBinary'
  | 'back'
  | 'cancel'
  | 'delete'
  | 'save'
  | 'saving'
  | 'saved'
  | 'deleted'
  | 'trustWarn'

  | 'invalidId'
  | 'invalidCommand'
  | 'invalidIdle'
  | 'invalidPool'
  | 'duplicateId'
  | 'saveProbing'
  | 'probeBlocked'
  | 'probeNotInstalled'
  | 'probeTimeout'
  | 'probeReady'
  | 'needCommand'
  | 'needCommandHint'
  | 'missingNeedInstall'
  | 'catalogAdded'
  | 'install'
  | 'installAndSave'
  | 'installTitle'
  | 'installClose'
  | 'installFailed'
  | 'installOk'
  | 'checkFailed'
  | 'needAuth'
  | 'tagReady'
  | 'tagMissing'
  | 'tagFailed'
  | 'tagUnchecked'
  | 'fieldId'
  | 'fieldTitle'
  | 'fieldEnabled'
  | 'fieldTrusted'
  | 'fieldCommand'
  | 'fieldArgs'
  | 'argsPlaceholder'
  | 'fieldModel'
  | 'fieldReasoning'
  | 'modelLoading'
  | 'modelRefresh'
  | 'modelEmpty'
  | 'modelAgentDefault'
  | 'reasoningAgentDefault'
  | 'reasoningEmpty'
  | 'cardThink'
  | 'cardTools'
  | 'cardPlan'
  | 'cardAnswer'
  | 'teamRunning'
  | 'teamIdle'
  | 'teamAdd'
  | 'teamInherit'
  | 'fieldIdleTtl'
  | 'fieldPoolMax'
  | 'probe'
  | 'probeFound'
  | 'probeMissing'
  | 'poolSize'
  | 'tagOn'
  | 'tagOff'
  | 'tagTrusted'
  | 'tagUntrusted'
  | 'defaultTitle'
  | 'cardTitle'
  | 'cardRunning'
  | 'cardOk'
  | 'cardError'
  | 'catalog_opencode_title'
  | 'catalog_opencode_summary'
  | 'catalog_custom_title'
  | 'catalog_custom_summary'

export const en: Record<WorkersKey, string> = {
  nav: 'ACP Worker',
  team: 'Team',
  teamIntro: 'Members the Leader started in this chat. Role, model, and thinking can be adjusted here.',
  teamEmpty: 'No team yet. The Leader forms one by calling acp_worker, or add a registered worker below.',
  teamAssign: 'Add',
  teamRunning: 'Running',
  teamIdle: 'Idle',
  teamAdd: 'Add',
  teamInherit: 'Inherit',
  teamRole: 'Role',
  roleGeneral: 'General',
  roleCoder: 'Coder',
  roleReview: 'Review',
  roleResearch: 'Research',
  title: 'ACP Worker',
  search: 'Search',
  searchPlaceholder: 'Search',
  advanced: 'More',
  advancedHide: 'Hide',
  confirmDelete: 'Delete this worker?',
  commandLine: '{command} {args}',
  closeEditor: 'Close',
  discard: 'Discard',
  listIntro:
    'Keep secrets in environment variables. With more than one worker, start the prompt with workerId: <id>.',
  empty: 'No workers yet.',
  addFromCatalog: 'Add from catalog',
  addCustom: 'Custom',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshOk: 'Registry updated',
  refreshFail: 'Refresh failed',
  fieldAuthors: 'Authors',
  fieldRepo: 'Repository',
  fieldSite: 'Website',
  catalogIntro: 'Already added items are disabled.',
  catalogLoading: 'Loading…',
  catalogSourceLive: 'Registry {version}',
  catalogSourceLkg: 'Registry {version} (cached)',
  catalogSourceBundled: 'Local templates',
  catalogCount: '{n}',
  distNpx: 'needs local CLI',
  distUvx: 'needs local CLI',
  distBinary: 'PATH',
  back: 'Back',
  cancel: 'Cancel',
  delete: 'Delete',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  deleted: 'Deleted',
  trustWarn: 'A started worker runs this command on your machine.',

  invalidId: 'id must start with a letter and use only a-z, 0-9, _ or -.',
  invalidCommand: 'Set a command. Bare node is not an ACP agent.',
  invalidIdle: 'Idle timeout must be a positive number.',
  invalidPool: 'Max processes must be 1–16.',
  duplicateId: 'This id is already used.',
  saveProbing: 'Checking whether it can start…',
  probeBlocked: '{reason}',
  probeNotInstalled: 'This machine has no command {name}. Install it, then save again.',
  probeTimeout: 'No reply in time. Check the command, or that the program speaks ACP.',
  probeReady: 'Ready to start',
  needCommand: 'This machine has no command {name}.',
  needCommandHint: 'Install first.',
  missingNeedInstall: '{name} ACP is not installed. Install it first.',
  catalogAdded: 'Added',
  install: 'Install',
  installAndSave: 'Install',
  installTitle: 'Installing {name}',
  installClose: 'Close',
  installFailed: 'Install failed',
  installOk: 'Installed. Checking…',
  checkFailed: 'Could not start',
  needAuth: 'Sign in first.',
  tagReady: 'Ready',
  tagMissing: 'Not installed',
  tagFailed: 'Could not start',
  tagUnchecked: 'Not checked',
  fieldId: 'id',
  fieldTitle: 'Name',
  fieldEnabled: 'Enabled',
  fieldTrusted: 'Trusted',
  fieldCommand: 'Command',
  fieldArgs: 'Arguments',
  argsPlaceholder: 'One per line',
  fieldModel: 'Model',
  fieldReasoning: 'Thinking',
  modelLoading: 'Loading models…',
  modelRefresh: 'Refresh',
  modelEmpty: 'ACP does not support listing models.',
  modelAgentDefault: 'Agent default',
  reasoningAgentDefault: 'Agent default',
  reasoningEmpty: 'This model does not declare thinking.',
  cardThink: 'Think',
  cardTools: 'Tool',
  cardPlan: 'Plan',
  cardAnswer: 'Answer',
  fieldIdleTtl: 'Idle timeout (ms)',
  fieldPoolMax: 'Max processes',
  probe: 'Check PATH',
  probeFound: 'Found: {path}',
  probeMissing: 'Not on PATH',
  poolSize: 'Running: {n}',
  tagOn: 'On',
  tagOff: 'Off',
  tagTrusted: 'Can start',
  tagUntrusted: 'Cannot start',
  defaultTitle: 'Default',
  cardTitle: 'ACP Worker',
  cardRunning: 'Running',
  cardOk: 'Done',
  cardError: 'Failed',
  catalog_opencode_title: 'OpenCode',
  catalog_opencode_summary: 'Local opencode acp',
  catalog_custom_title: 'Custom command',
  catalog_custom_summary: 'Type the command yourself',
}

export const zh: Record<WorkersKey, string> = {
  nav: 'ACP Worker',
  team: '团队',
  teamIntro: 'Leader 在本对话里组建的成员。可改角色、模型和思考。',
  teamEmpty: '还没有团队。Leader 调用 acp_worker 会自动入座，也可从下面添加已注册 Worker。',
  teamAssign: '添加',
  teamRunning: '运行中',
  teamIdle: '空闲',
  teamAdd: '添加',
  teamInherit: '继承',
  teamRole: '角色',
  roleGeneral: '通用',
  roleCoder: '编码',
  roleReview: '审查',
  roleResearch: '调研',
  title: 'ACP Worker',
  search: '搜索',
  searchPlaceholder: '搜索',
  advanced: '更多',
  advancedHide: '收起',
  confirmDelete: '删除这个 Worker？',
  commandLine: '{command} {args}',
  closeEditor: '关闭',
  discard: '放弃',
  listIntro: '密钥用环境变量。多个 Worker 时在首行写 workerId: <id>。',
  empty: '还没有 Worker。',
  addFromCatalog: '从目录添加',
  addCustom: '自定义',
  refresh: '刷新',
  refreshing: '刷新中…',
  refreshOk: '目录已更新',
  refreshFail: '刷新失败',
  fieldAuthors: '作者',
  fieldRepo: '仓库',
  fieldSite: '网站',
  catalogIntro: '已添加的不可再选。',
  catalogLoading: '加载中…',
  catalogSourceLive: '官方目录 {version}',
  catalogSourceLkg: '官方目录 {version}（缓存）',
  catalogSourceBundled: '本地模板',
  catalogCount: '{n}',
  distNpx: '需本机命令',
  distUvx: '需本机命令',
  distBinary: 'PATH',
  back: '返回',
  cancel: '取消',
  delete: '删除',
  save: '保存',
  saving: '保存中…',
  saved: '已保存',
  deleted: '已删除',
  trustWarn: '启动后就是在本机跑这条命令。',

  invalidId: 'id 用字母开头，只能含 a-z、数字、_ 或 -。',
  invalidCommand: '先填命令。单独的 node 不是 ACP 进程。',
  invalidIdle: '空闲超时必须是正数。',
  invalidPool: '进程数必须是 1–16。',
  duplicateId: '这个 id 已经有了。',
  saveProbing: '正在检查能不能启动…',
  probeBlocked: '{reason}',
  probeNotInstalled: '本机没有命令 {name}。先安装这个命令，装好后再保存。',
  probeTimeout: '等太久没有回应。先看命令对不对。',
  probeReady: '可以启动了',
  needCommand: '本机没有命令 {name}。',
  needCommandHint: '先安装。',
  missingNeedInstall: '未检查到 {name} ACP，需要先安装。',
  catalogAdded: '已添加',
  install: '安装',
  installAndSave: '安装',
  installTitle: '正在安装 {name}',
  installClose: '关闭',
  installFailed: '安装失败',
  installOk: '装好了，正在检查…',
  checkFailed: '没能启动',
  needAuth: '需要先登录',
  tagReady: '可用',
  tagMissing: '未安装',
  tagFailed: '没能启动',
  tagUnchecked: '未检查',
  fieldId: 'id',
  fieldTitle: '名称',
  fieldEnabled: '启用',
  fieldTrusted: '已信任',
  fieldCommand: '命令',
  fieldArgs: '参数',
  argsPlaceholder: '每行一个',
  fieldModel: '模型',
  fieldReasoning: '思考',
  modelLoading: '正在拉取模型…',
  modelRefresh: '刷新',
  modelEmpty: 'ACP 不支持获取模型列表。',
  modelAgentDefault: 'Agent 默认',
  reasoningAgentDefault: 'Agent 默认',
  reasoningEmpty: '当前模型不支持思考。',
  cardThink: '思考',
  cardTools: '工具',
  cardPlan: '计划',
  cardAnswer: '答复',
  fieldIdleTtl: '空闲超时（毫秒）',
  fieldPoolMax: '最多进程数',
  probe: '检测 PATH',
  probeFound: '找到：{path}',
  probeMissing: 'PATH 上没有',
  poolSize: '运行中：{n}',
  tagOn: '启用',
  tagOff: '停用',
  tagTrusted: '可启动',
  tagUntrusted: '不可启动',
  defaultTitle: '默认',
  cardTitle: 'ACP Worker',
  cardRunning: '运行中',
  cardOk: '完成',
  cardError: '失败',
  catalog_opencode_title: 'OpenCode',
  catalog_opencode_summary: '本机的 opencode acp',
  catalog_custom_title: '自定义命令',
  catalog_custom_summary: '自己填命令',
}

export type Translate = (key: WorkersKey, params?: Record<string, string | number>) => string
