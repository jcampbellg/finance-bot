import { budgetOnStart } from '@conversations/budget'
import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { Account } from '@prisma/client'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'

const maxAccounts = 10

export async function accountsOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)

  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'accounts',
      data: {}
    }
  })

  const accounts = await prisma.account.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega una cuenta a\n<b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        accounts.length < maxAccounts ? [{ text: 'Agregar', callback_data: 'add' }] : [],
        ...accountsButtons(accounts),
        [{ text: 'Regresar', callback_data: 'back' }]
      ]
    }
  })
  return
}

export async function accountsOnText({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)

  if (!user) return
  if (!book) return

  const text = msg?.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (conversationData.action === 'add') {
    const isValid = z.string().min(3).max(50).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

    const newAccount = await prisma.account.create({
      data: {
        description: text,
        bookId: book.id
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'accounts',
        data: {
          action: 'edit',
          accountId: newAccount.id
        }
      }
    })

    await bot.sendMessage(userId, `Cuenta <b>${text}</b> agregada.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: accountButtons()
      }
    })
  }

  if (conversationData.action === 'edit') {
    if (conversationData.property === 'description') {
      const isValid = z.string().min(3).max(50).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
        return
      }

      const account = await prisma.account.findUnique({
        where: {
          id: conversationData.accountId || 0
        }
      })

      if (!account) {
        await bot.sendMessage(userId, 'La cuenta seleccionada ya no existe.')
        // @ts-ignore
        await accountsOnStart({ bot, query, msg })
        return
      }

      await prisma.account.update({
        where: {
          id: account.id
        },
        data: {
          description: text
        }
      })

      await bot.sendMessage(userId, `Cuenta actualizada: <b>${text}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: accountButtons()
        }
      })
    }
  }
}

export async function accountsOnCallbackQuery({ bot, query }: QueryProps) {
  const { userId, user, book } = await auth({ query, bot } as QueryProps)
  if (!user) return
  if (!book) return
  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (btnPress === 'back') {
    if (conversationData.action === 'edit') {
      await accountsOnStart({ bot, query })
      return
    }

    await budgetOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    const accountsCount = await prisma.account.count({
      where: {
        bookId: book.id
      }
    })

    if (accountsCount >= maxAccounts) {
      await bot.sendMessage(userId, `No puedes agregar más de ${maxAccounts} cuentas.`)
      await accountsOnStart({ bot, query })
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'accounts',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción de la cuenta a agregar.')
    return
  }

  if (!conversationData.action) {
    // btn press is a account id
    const accountId = parseInt(btnPress)
    if (Number.isNaN(accountId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'accounts',
        data: {
          action: 'edit',
          accountId: accountId
        }
      }
    })

    const account = await prisma.account.findUnique({
      where: {
        id: accountId,
      }
    })

    if (!account) {
      await bot.sendMessage(userId, 'La cuenta seleccionada ya no existe.')
      await accountsOnStart({ bot, query })
      return
    }

    await bot.sendMessage(userId, `Editar <b>${account.description}</b>:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: accountButtons()
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    const accountToEdit = await prisma.account.findUnique({
      where: {
        id: conversationData.accountId || 0
      }
    })

    if (!accountToEdit) {
      await bot.sendMessage(userId, 'La cuenta seleccionada ya no existe.')
      await accountsOnStart({ bot, query })
      return
    }

    if (btnPress === 'delete') {
      const accountsCount = await prisma.account.count({
        where: {
          bookId: book.id
        }
      })

      if (accountsCount <= 1) {
        await bot.sendMessage(userId, 'No puedes eliminar la única cuenta del libro.')
        await accountsOnStart({ bot, query })
        return
      }

      const expensesCount = await prisma.expense.count({
        where: {
          accountId: accountToEdit.id
        }
      })

      if (expensesCount > 0) {
        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'accounts',
            data: {
              action: 'edit',
              accountId: accountToEdit.id
            }
          }
        })
        await bot.sendMessage(userId, `No puedes eliminar la cuenta <b>${accountToEdit.description}</b> porque tiene gastos asociados.`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: accountButtons()
          }
        })
        return
      }

      await prisma.account.delete({
        where: {
          id: accountToEdit.id
        }
      })

      await bot.sendMessage(userId, `Cuenta eliminada: <b>${accountToEdit.description}</b>`, {
        parse_mode: 'HTML'
      })
      await accountsOnStart({ bot, query })
      return
    }

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'accounts',
          data: {
            action: 'edit',
            accountId: accountToEdit.id,
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Escribe la nueva descripción de la cuenta:')
      return
    }
  }
}

export function accountButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}

export function accountsButtons(accounts: Account[]): TelegramBot.InlineKeyboardButton[][] {
  const accountsGroups = accounts.reduce((acc, curr, i) => {
    if (i % 3 === 0) acc.push([curr])
    else acc[acc.length - 1].push(curr)
    return acc
  }, [] as Account[][])

  return accountsGroups.map(group => {
    return group.map(acc => ({
      text: `${acc.description}`,
      callback_data: `${acc.id}`
    }))
  })
}