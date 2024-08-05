import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function transactionCategoryText(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'category') {
    await step1(params)
    return
  }

  if (conversation.subSubject === 'category_create') {
    await step2(params)
    return
  }
}