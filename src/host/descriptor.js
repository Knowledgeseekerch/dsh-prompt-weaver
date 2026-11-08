import { PACKAGE_ID, SERVICE_NAME } from '../core/constants.js'

const EMPTY_MODEL = Object.freeze({})
const RESULT_CODEC = Object.freeze({ mode: 'src-json' })

export function createTypertDescriptor() {
  return Object.freeze({
    package: PACKAGE_ID,
    face: 'host',
    schemas: [],
    model: EMPTY_MODEL,
    invocations: [
      invocation('enhance'),
      invocation('listFrameworks'),
      invocation('importConfig'),
      invocation('exportConfig'),
      invocation('takePending'),
      invocation('clearPending'),
    ],
  })
}

function invocation(method) {
  return Object.freeze({
    id: `${PACKAGE_ID}#${SERVICE_NAME}/${method}`,
    service: SERVICE_NAME,
    namespace: SERVICE_NAME,
    method,
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        codec: RESULT_CODEC,
      },
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: RESULT_CODEC,
      },
    ],
    cancellation: { parameter: 'signal' },
    result: { mode: 'src-json' },
  })
}
