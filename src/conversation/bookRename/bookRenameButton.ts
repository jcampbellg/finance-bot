import { ConversationProps } from '@customTypes/messageTypes'
import step1 from './step1'

export default async function bookRenameButton(params: ConversationProps) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('book_rename')) {
    await step1(params)
    return
  }
}