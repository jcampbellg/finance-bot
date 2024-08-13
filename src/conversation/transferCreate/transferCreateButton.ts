import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'
import step3 from './step3'
import step4 from './step4'

export default async function transferCreateButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (conversation.subSubject === 'amount-a' || btnPress === 'transfer_create') {
    await step1(params)
    return
  }

  if (btnPress.startsWith('account_select')) {
    await step2(params)
    return
  }


  if (btnPress === 'same_data') {
    await step4(params, true)
    return
  }

  if (conversation.subSubject.startsWith('currency')) {
    await step3(params)
    return
  }
}