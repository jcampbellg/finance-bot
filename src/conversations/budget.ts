import { MsgAndQueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'

export async function budgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  await prisma.conversation.upsert({
    where: {
      chatId: userId
    },
    update: {
      state: 'settings',
      data: {}
    },
    create: {
      chatId: userId,
      state: 'settings',
      data: {}
    }
  })

  const bookSelected = await prisma.bookSelected.findFirst({
    where: {
      book: {
        ownerId: userId
      },
      chatId: userId
    },
    include: {
      book: true
    }
  })

  if (!bookSelected) {
    await bot.sendMessage(userId, '¡Primero necesitas seleccionar un libro contable!')
    return
  }

  const book = bookSelected.book

  await bot.sendMessage(userId, `¡Vamos a configurar el prespuesto para <b>${book.title}</b>! 📚`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Cuentas', callback_data: 'accounts' }, { text: 'Categorias', callback_data: 'categories' }],
        [{ text: 'Limites', callback_data: 'limits' }, { text: 'Pagos Fijos', callback_data: 'payments' }],
      ]
    }
  })

  return
}