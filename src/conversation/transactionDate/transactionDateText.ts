import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'

export default async function transactionDateText(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'date') {
    step2(params)
    return
  }
}