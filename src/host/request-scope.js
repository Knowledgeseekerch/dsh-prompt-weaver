import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 请求作用域。
 *
 * 之前 service.currentAgent 是共享可变字段：两个 enhance 并发时，
 * 请求 A 在 await 期间读到的可能是请求 B 的 agent/session，
 * 于是上下文、工作目录、模型路由都可能串到别的会话。
 *
 * 这里用 AsyncLocalStorage 让每个请求携带自己的作用域，
 * 不需要把 agent 一路透传到 provider 和 contextProvider。
 */
const storage = new AsyncLocalStorage()

/** 在指定作用域内执行 fn；作用域对 fn 内所有异步调用可见。 */
export function runWithScope(scope, fn) {
  return storage.run(scope, fn)
}

/** 当前请求的作用域，未在请求内调用时为 undefined。 */
export function currentScope() {
  return storage.getStore()
}
