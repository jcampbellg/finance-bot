import { ConversationProps } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function bookDeleteButton(params: ConversationProps) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('book_delete_')) {
    await step1(params)
    return
  }

  if (query.data === 'delete_confirm') {
    await step2(params)
    return
  }
}