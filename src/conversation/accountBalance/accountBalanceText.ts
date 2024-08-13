import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'
import step3 from './step3'

export default async function accountBalanceText(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'balance') {
    step2(params)
    return
  }

  if (conversation.subSubject === 'currency') {
    step3(params)
    return
  }
}