# @pihuo/dsh-pihuo-presets

Installs packaged agent presets into `$DSH_HOME/.agent-presets` on load.

Official `dsh` always last-writes `agent-presets.config.roots` to the shipped
root, so a bundle cannot add a second system root. The user roster is the
supported out-of-tree path.

| id | Picker name |
|---|---|
| `pihuo-leader` | PiHuo Leader — `acp_worker` coordinator (no bash/fs) |

The `pihuo-acp` provider stays on the host. Only this preset registers the
`acp_worker` tool. New sessions must pick **PiHuo Leader** (or set it as the
default) to see the tool.
