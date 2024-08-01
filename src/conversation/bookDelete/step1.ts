import confirmMessage from '@botMessage/confirmMessage'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { conversation, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const bookId = query.data.replace('book_delete_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'book_delete',
    subSubject: '',
    edit: {
      bookId: bookId
    }
  })

  await confirmMessage(params, {
    callbackYes: 'delete_confirm',
    callbackNo: `book_view_${bookId}`,
    text: `¿Estás seguro de que quieres eliminar este libro?\n\nPor favor, confirma si deseas proceder.`
  })
}