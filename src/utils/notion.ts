import { Client } from '@notionhq/client'

if (!process.env.notionSecret) {
  throw new Error('notionSecret is not defined')
}
const notion = new Client({ auth: process.env.notionSecret })

export default notion