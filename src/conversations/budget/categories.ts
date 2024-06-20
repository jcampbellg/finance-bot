import { budgetOnStart } from '@conversations/budget'
import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import { LimitsWithAmount } from '@customTypes/prismaTypes'
import { Category } from '@prisma/client'

dayjs.extend(utc)
dayjs.extend(timezone)

const maxCategories = 50

export async function categoriesOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    }
  })

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'categories',
      data: {}
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega una categoria a <b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        categories.length < maxCategories ? [{ text: 'Agregar', callback_data: 'add' }] : [],
        ...categoriesButtons(categories),
        [{ text: 'Regresar', callback_data: 'back' }]
      ]
    }
  })
  return
}

export async function categoriesOnText({ bot, msg }: MsgProps) {
  const userId = msg?.chat.id
  const text = msg?.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  if (conversationData.action === 'add') {
    const isValid = z.string().min(3).max(50).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

    const newCategory = await prisma.category.create({
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
        state: 'categories',
        data: {
          action: 'edit',
          categoryId: newCategory.id
        }
      }
    })

    await bot.sendMessage(userId, `Categoria <b>${text}</b> agregada.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: categoryButtons()
      }
    })
  }

  if (conversationData.action === 'edit') {
    const categoryToEdit = await prisma.category.findUnique({
      where: {
        id: conversationData.categoryId || 0
      }
    })

    if (!categoryToEdit) {
      await bot.sendMessage(userId, 'La categoria seleccionada ya no existe.')
      await categoriesOnStart({ bot, msg })
      return
    }

    if (conversationData.property === 'description') {
      const isValid = z.string().min(3).max(50).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
        return
      }

      const category = await prisma.category.findUnique({
        where: {
          id: conversationData.categoryId || 0
        }
      })

      if (!category) {
        await bot.sendMessage(userId, 'La categoria seleccionada ya no existe.')
        // @ts-ignore
        await categoriesOnStart({ bot, query, msg })
        return
      }

      await prisma.category.update({
        where: {
          id: category.id
        },
        data: {
          description: text
        }
      })

      await bot.sendMessage(userId, `Categoria actualizada: <b>${text}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: categoryButtons()
        }
      })
    }

    if (conversationData.property === 'limit') {
      if (conversationData.limit === undefined) {
        const limit = parseFloat(text)
        if (Number.isNaN(limit) || limit < 0) {
          await bot.sendMessage(userId, 'La respuesta debe ser un número mayor o igual a 0.')
          return
        }

        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'categories',
            data: {
              action: 'edit',
              categoryId: conversationData.categoryId,
              property: 'limit',
              limit: limit
            }
          }
        })

        await bot.sendMessage(userId, `Su moneda, en 3 letras:`, {
          parse_mode: 'HTML',
        })
        return
      }

      const isValid = z.string().regex(/[a-zA-Z]+/).length(3).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser de 3 letras.')
        return
      }

      const currency = text.toUpperCase()

      const limitAmount = await prisma.amountCurrency.create({
        data: {
          amount: conversationData.limit,
          currency: currency
        }
      })

      await prisma.limit.create({
        data: {
          bookId: book.id,
          categoryId: categoryToEdit.id,
          amountId: limitAmount.id,
          validFrom: dayjs().utc().startOf('month').format()
        }
      })

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: conversationData.categoryId
          }
        }
      })

      const newLimits = await prisma.limit.findMany({
        where: {
          categoryId: categoryToEdit.id
        },
        include: {
          amount: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      await bot.sendMessage(userId, `<b>${categoryToEdit.description}</b>${limitsListText(newLimits)}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: categoryButtons()
        }
      })
      return
    }
  }
}

export async function categoriesOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id
  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (btnPress === 'back') {
    if (conversationData.action === 'edit') {
      await categoriesOnStart({ bot, query })
      return
    }

    await budgetOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    const categoriesCount = await prisma.category.count({
      where: {
        bookId: conversationData.bookId
      }
    })

    if (categoriesCount >= maxCategories) {
      await bot.sendMessage(userId, `No puedes agregar más de ${maxCategories} categorias.`)
      await categoriesOnStart({ bot, query })
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'categories',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción de la categoria a agregar.')
    return
  }

  if (!conversationData.action) {
    // btn press is a category id
    const categoryId = parseInt(btnPress)
    if (Number.isNaN(categoryId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'categories',
        data: {
          action: 'edit',
          categoryId: categoryId
        }
      }
    })

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      include: {
        limits: {
          include: {
            amount: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!category) {
      await bot.sendMessage(userId, 'La categoria seleccionada ya no existe.')
      await categoriesOnStart({ bot, query })
      return
    }

    await bot.sendMessage(userId, `Editar <b>${category.description}</b>${limitsListText(category.limits)}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: categoryButtons()
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    const categoryToEdit = await prisma.category.findUnique({
      where: {
        id: conversationData.categoryId || 0
      }
    })

    if (!categoryToEdit) {
      await bot.sendMessage(userId, 'La categoria seleccionada ya no existe.')
      await categoriesOnStart({ bot, query })
      return
    }

    if (btnPress === 'delete') {
      await prisma.limit.deleteMany({
        where: {
          categoryId: categoryToEdit.id
        }
      })

      await prisma.category.update({
        where: {
          id: categoryToEdit.id
        },
        data: {
          expenses: {
            set: []
          }
        }
      })

      await prisma.category.delete({
        where: {
          id: categoryToEdit.id
        }
      })

      await bot.sendMessage(userId, `Categoria con sus limites eliminada: <b>${categoryToEdit.description}</b>`, {
        parse_mode: 'HTML'
      })
      await categoriesOnStart({ bot, query })
      return
    }

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id,
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Escribe la nueva descripción de la categoria:')
      return
    }

    if (btnPress === 'limit') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id,
            property: 'limit'
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el nuevo limite para\n<b>${categoryToEdit.description}</b>:`, {
        parse_mode: 'HTML'
      })
      return
    }
  }
}

export function categoriesButtons(categories: Category[]): TelegramBot.InlineKeyboardButton[][] {
  const categoriesGroups = categories.reduce((acc, curr, i) => {
    if (i % 3 === 0) acc.push([curr])
    else acc[acc.length - 1].push(curr)
    return acc
  }, [] as Category[][])

  return categoriesGroups.map(group => {
    return group.map(cat => ({
      text: `${cat.description}`,
      callback_data: `${cat.id}`
    }))
  })
}

export function categoryButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Poner Limite', callback_data: 'limit' }],
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}

export function limitsListText(limits: LimitsWithAmount[]) {
  const currencyInLimits = [... new Set(limits.map(l => l.amount.currency))]

  const lastLimits = currencyInLimits.map(currency => {
    const limit = limits.find(l => l.amount.currency === currency)
    return limit
  }).filter(l => l && l?.amount.amount > 0)

  if (lastLimits.length === 0) return ''

  return `\n\nLimites:\n` + lastLimits.map(l => {
    return `${numeral(l?.amount.amount || 0).format('0,0.00')} ${l?.amount.currency}`
  }).join('\n')
}