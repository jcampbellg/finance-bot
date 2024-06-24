import { prisma } from '@utils/prisma'
import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'

export async function shareOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'share',
      data: {}
    }
  })

  await bot.sendMessage(userId, 'Compartir libro contable con otro usuario o grupo', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Crear llave', callback_data: 'create' }],
        [{ text: 'Ingresar llave', callback_data: 'access' }]
      ]
    }
  })
  return
}

export async function shareOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query })
  if (!user) return
  if (!book) return

  const btnText = query.data

  if (btnText === 'create') {
    const share = await prisma.shareBook.create({
      data: {
        bookId: book.id
      }
    })

    await bot.sendMessage(userId, `Copia la llave de acceso:\n\n<code>${share.key}</code>\n\nPegala en la cuenta o grupo.`, {
      parse_mode: 'HTML'
    })
  }
}