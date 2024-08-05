import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'
import step3 from './step3'

export default async function transactionSplitText(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'category') {
    await step3(params)
    return
  }

  if (conversation.subSubject === 'amount') {
    await step2(params)
    return
  }
}