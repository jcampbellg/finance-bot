import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step3 from './step3'
import step4 from './step4'

export default async function transactionCreateButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (['transaction_create_expense', 'transaction_create_deposit'].indexOf(btnPress) !== -1) {
    await step1(params)
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
}