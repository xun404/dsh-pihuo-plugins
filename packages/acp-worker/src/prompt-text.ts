/**
 * Leader-facing system section. Lists this chat's seated team, or the
 * registered workers the Leader may start. Role → worker · model · thinking.
 * Must not include command lines.
 */
import type { ChatTeam, WorkerRosterEntry } from '@pihuo/dsh-worker-protocol'

function displayModel(row: { model?: string }): string {
  return row.model === undefined || row.model === '' ? 'agent default' : row.model
}

function displayThinking(row: { reasoning?: string }): string {
  return row.reasoning === undefined || row.reasoning === '' ? 'agent default' : row.reasoning
}

/**
 * Text for the `pihuo-workers` system section.
 * Empty string means omit the section (not a PiHuo Leader session).
 */
export function leaderTeamPrompt(
  presetId: string | undefined,
  team: ChatTeam,
  workers: readonly WorkerRosterEntry[],
): string {
  if (presetId !== undefined && presetId !== '' && presetId !== 'pihuo-leader') return ''
  const byId = new Map(workers.map(row => [row.id, row]))
  const seated = team.members
    .map((member) => {
      const worker = byId.get(member.workerId)
      if (worker === undefined || !worker.enabled || !worker.trusted) return undefined
      const model = member.model ?? worker.model
      const thinking = member.reasoning ?? worker.reasoning
      return `- ${member.role} → ${worker.title} (${worker.id}) · ${displayModel(model === undefined ? {} : { model })} · ${displayThinking(thinking === undefined ? {} : { reasoning: thinking })}`
    })
    .filter((line): line is string => line !== undefined)

  if (seated.length > 0) {
    const hint = seated.length > 1
      ? 'When more than one member is listed, begin the acp_worker prompt with `workerId: <id>` or `role: <role>` then the task.'
      : 'There is one team member; omit workerId unless you want to name it.'
    return `Team for this chat (acp_worker):\n${seated.join('\n')}\n${hint}\nYou have no filesystem or shell. Do not read workers.json. Report only what acp_worker returned.`
  }

  const ready = workers.filter(row => row.enabled && row.trusted)
  if (ready.length === 0) {
    return 'No registered trusted worker. The user must add one in Settings → ACP Worker before you can form a team.'
  }
  const lines = ready.map(row => `- ${row.title} (${row.id}) · ${displayModel(row)} · ${displayThinking(row)}`)
  const hint = ready.length > 1
    ? 'The Team header is empty. Forming a team means calling acp_worker once per role. When more than one worker is listed, begin the prompt with `workerId: <id>` then the task (include the role in that prompt).'
    : 'The Team header is empty. Forming a team means calling acp_worker. There is one registered worker; omit workerId unless you want to name it.'
  return `Registered workers you may start (acp_worker):\n${lines.join('\n')}\n${hint}\nYou have no filesystem or shell. Do not read workers.json. Do not invent a worker that is not listed.`
}

/** Last `agent-preset/selected` on the parent session, when any. */
export function selectedPreset(
  events: ReadonlyArray<{ readonly type?: string; readonly data?: { readonly agentPreset?: unknown } }> | undefined,
): string | undefined {
  if (events === undefined) return undefined
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'agent-preset/selected') continue
    const id = event.data?.agentPreset
    if (typeof id === 'string' && id !== '') return id
  }
  return undefined
}

/** Encode live Think/Tool samples after the model-facing answer. The card strips this. */
export function encodeActivityTrailer(activities: readonly { kind: string; text: string }[]): string {
  if (activities.length === 0) return ''
  return `\n\n<!--pihuo-activity\n${JSON.stringify(activities)}\n-->`
}
