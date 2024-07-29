import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import { endButtons, onConversationEnd } from './mainMenu'

export async function onRoleAddBegin(params: ConversationProps) {
  const { query, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('role_add_', '').split('_')[0]
  const roleType = query.data.replace('role_add_', '').split('_')[1]

  await xprisma.conversation.update(conversation.id, {
    subject: 'role_add',
    edit: { bookId },
    subSubject: roleType
  })

  await bot.sendMessage(userId, `Por favor, pega el ID del usuario aquí.`)
}

export async function onRoleAddText(params: ConversationProps) {
  const { user, bot, userId, conversation, text, ctx } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  const bookId = conversation.edit.bookId as string

  if (['admin', 'owner', 'spender'].indexOf(conversation.subSubject) !== -1) {
    const success = await xprisma.role.create(user, {
      bookId: bookId,
      toUserId: text,
      role: conversation.subSubject === 'admin' ? 'FINANCE' : conversation.subSubject === 'owner' ? 'OWNER' : 'SPENDER'
    })

    if (!success) {
      await bot.sendMessage(userId, `¡No se pudo añadir el rol! 😢`)
      await onConversationEnd(params)
      return
    } else {
      await xprisma.conversation.update(conversation.id, {
        subject: 'book',
        subSubject: '',
        edit: {},
        messageId: null
      })

      await bot.sendMessage(userId, `¡Rol añadido! 🎉`, {
        reply_markup: {
          inline_keyboard: endButtons(true, `book_${bookId}`),
        }
      })
      return
    }
  }
}