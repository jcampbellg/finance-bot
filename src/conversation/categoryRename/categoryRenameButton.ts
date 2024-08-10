import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'

export default async function categoryRenameButton(params: ConversationPropsWithBookSelected) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('category_rename_')) {
    await step1(params)
    return
  }
}