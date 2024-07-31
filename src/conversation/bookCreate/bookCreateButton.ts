import { ConversationProps } from '@customTypes/messageTypes'
import step1 from './step1'

export default async function bookCreateButton(params: ConversationProps) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data === 'book_create') {
    await step1(params)
    return
  }
}