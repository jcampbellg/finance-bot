import confirmMessage from '@botMessage/confirmMessage'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { conversation, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const isCategory = query.data.startsWith('category_delete_')
  const itemId = query.data.replace('account_delete_', '').replace('category_delete_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: isCategory ? 'category_delete' : 'account_delete',
    subSubject: '',
    edit: {
      transactionId: itemId
    }
  })

  await confirmMessage(params, {
    callbackYes: 'delete_confirm',
    callbackNo: isCategory ? `category_view_${itemId}` : `account_view_${itemId}`,
    text: `¿Estás seguro de que lo quieres eliminar?\n\nPor favor, confirma si deseas proceder.`
  })
}