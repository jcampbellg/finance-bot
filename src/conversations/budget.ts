import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { accountsOnStart } from '@conversations/budget/accounts'
import { categoriesOnStart } from './budget/categories'
import auth from '@utils/auth'
import { incomesOnStart } from './budget/incomes'

export async function budgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'budget',
      data: {}
    }
  })

  await bot.sendMessage(userId, `¡Vamos a configurar el prespuesto para <b>${book.title}</b>! 📚`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Cuentas', callback_data: 'accounts' }, { text: 'Ingresos', callback_data: 'incomes' }, { text: 'Categorias', callback_data: 'categories' }],
      ]
    }
  })
  return
}

export async function bundgetOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book } = await auth({ query, bot } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const btnPress = query.data

  if (btnPress === 'accounts') {
    accountsOnStart({ bot, query })
    return
  }

  if (btnPress === 'categories') {
    categoriesOnStart({ bot, query })
    return
  }

  if (btnPress === 'incomes') {
    incomesOnStart({ bot, query })
    return
  }
}