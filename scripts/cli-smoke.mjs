// CLI 冒烟：在任意平台上验证离线命令能跑通。
//
// 原先 npm script 写成 `... --json >/dev/null`，在 Windows 上 `/dev/null`
// 不存在，整条命令直接失败；CI 加 Windows 后才暴露出来。
import { spawnSync } from 'node:child_process'

const runs = [
  ['bin/dsh-prompt-weaver.js', ['enhance', '--input', 'examples/input/basic.txt', '--json']],
  ['bin/dsh-prompt-weaver.js', ['frameworks', 'list', '--config', 'examples/config/dsh-prompt-weaver.config.json']],
]

for (const [entry, args] of runs) {
  const result = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(`cli smoke failed: ${entry} ${args.join(' ')}`)
    console.error(result.stdout ?? '')
    console.error(result.stderr ?? '')
    process.exit(1)
  }
  if ((result.stdout ?? '').trim().length === 0) {
    console.error(`cli smoke produced no output: ${entry} ${args.join(' ')}`)
    process.exit(1)
  }
}

console.log('cli smoke ok')
