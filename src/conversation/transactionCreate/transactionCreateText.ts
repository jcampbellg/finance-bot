import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'
import step3 from './step3'
import step4 from './step4'
import step5 from './step5'

export default async function transactionCreateText(params: ConversationPropsWithBookSelected) {
  const { conversation, ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'description') {
    await step2(params)
    return
  }

  if (conversation.subSubject === 'account') {
    await step3(params)
    return
  }

  if (conversation.subSubject === 'currency') {
    await step4(params)
    return
  }

  if (conversation.subSubject === 'amount') {
    await step5(params)
    return
  }
}