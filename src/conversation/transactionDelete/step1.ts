import confirmMessage from '@botMessage/confirmMessage'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { conversation, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_delete_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_delete',
    subSubject: '',
    edit: {
      transactionId: transactionId
    }
  })

  await confirmMessage(params, {
    callbackYes: 'delete_confirm',
    callbackNo: `transaction_view_${transactionId}`,
    text: `¿Estás seguro de que quieres eliminar esta transación?\n\nPor favor, confirma si deseas proceder.`
  })
}