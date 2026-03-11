import https from 'node:https'
import http from 'node:http'

interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result?: any
  error?: { message: string; code: number; data?: { message: string } }
}

const agent = new https.Agent({ rejectUnauthorized: false })

function jsonrpc(url: string, service: string, method: string, args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${url}/jsonrpc`)
    const isHttps = parsedUrl.protocol === 'https:'
    const lib = isHttps ? https : http

    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Date.now(),
    })

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      ...(isHttps ? { agent } : {}),
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const json: JsonRpcResponse = JSON.parse(data)
          if (json.error) {
            const msg = json.error.data?.message || json.error.message
            reject(new Error(msg))
          } else {
            resolve(json.result)
          }
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function listDatabases(url: string): Promise<string[]> {
  try {
    return await jsonrpc(url, 'db', 'list', [])
  } catch {
    return []
  }
}

export async function authenticate(
  url: string,
  db: string,
  login: string,
  password: string
): Promise<number | false> {
  const uid = await jsonrpc(url, 'common', 'authenticate', [db, login, password, {}])
  return uid || false
}

export async function executeKw(
  url: string,
  db: string,
  uid: number,
  password: string,
  model: string,
  method: string,
  args: any[],
  kwargs: Record<string, any> = {}
): Promise<any> {
  return jsonrpc(url, 'object', 'execute_kw', [db, uid, password, model, method, args, kwargs])
}

export async function getProjects(url: string, db: string, uid: number, password: string) {
  return executeKw(url, db, uid, password, 'project.project', 'search_read', [[]], {
    fields: ['name', 'task_count', 'user_id'],
    order: 'name asc',
  })
}

export async function getTasks(
  url: string,
  db: string,
  uid: number,
  password: string,
  projectId?: number
) {
  const domain = projectId ? [['project_id', '=', projectId]] : []
  return executeKw(url, db, uid, password, 'project.task', 'search_read', [domain], {
    fields: ['name', 'project_id', 'stage_id', 'date_deadline', 'priority', 'kanban_state', 'user_ids'],
    order: 'priority desc, date_deadline asc, id desc',
  })
}

export async function getUserNames(
  url: string,
  db: string,
  uid: number,
  password: string,
  userIds: number[]
): Promise<Record<number, string>> {
  if (!userIds.length) return {}
  const users = await executeKw(url, db, uid, password, 'res.users', 'read', [userIds], {
    fields: ['name'],
  })
  const map: Record<number, string> = {}
  for (const u of users) map[u.id] = u.name
  return map
}

export async function getStages(
  url: string,
  db: string,
  uid: number,
  password: string,
  projectId?: number
) {
  const domain: any[] = []
  if (projectId) {
    // Get stages associated with this project's task type
    const projects = await executeKw(url, db, uid, password, 'project.project', 'read', [[projectId]], {
      fields: ['type_ids'],
    })
    const stageIds: number[] = projects[0]?.type_ids || []
    if (stageIds.length) {
      domain.push(['id', 'in', stageIds])
    }
  }
  return executeKw(url, db, uid, password, 'project.task.type', 'search_read', [domain], {
    fields: ['name', 'sequence'],
    order: 'sequence asc',
  })
}

export async function changeTaskStage(
  url: string,
  db: string,
  uid: number,
  password: string,
  taskId: number,
  stageId: number
): Promise<boolean> {
  return executeKw(url, db, uid, password, 'project.task', 'write', [[taskId], { stage_id: stageId }])
}

export async function createTimesheet(
  url: string,
  db: string,
  uid: number,
  password: string,
  taskId: number,
  projectId: number,
  description: string,
  hours: number,
  date: string
): Promise<number> {
  return executeKw(url, db, uid, password, 'account.analytic.line', 'create', [
    {
      name: description,
      project_id: projectId,
      task_id: taskId,
      unit_amount: hours,
      date: date,
    },
  ])
}
