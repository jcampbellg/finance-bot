import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { accountsOnStart } from './budgets/accounts'

export async function budgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  await prisma.conversation.upsert({
    where: {
      chatId: userId
    },
    update: {
      state: 'budget',
      data: {}
    },
    create: {
      chatId: userId,
      state: 'budget',
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

export async function bundgetOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id

  const conversation = await prisma.conversation.findFirst({
    where: {
      chatId: userId
    }
  })

  if (!conversation) {
    return
  }

  const btnPress = query.data

  if (btnPress === 'accounts') {
    accountsOnStart({ bot, query })
    return
  }

  return
}