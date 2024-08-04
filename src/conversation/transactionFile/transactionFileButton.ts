import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import xprisma from '@utils/xprisma'

export default async function transactionFileButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  const transactionId = btnPress.replace(`transaction_file_`, '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_file',
    subSubject: 'file',
    edit: {
      transactionId: transactionId
    }
  })

  await step1(params)
}