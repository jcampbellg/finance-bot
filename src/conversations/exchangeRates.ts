import { MsgAndQueryProps, MsgProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import { waitingForCommandOnStart } from '@conversations/waitingForCommand'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { currencyEval, mathEval } from '@utils/isValid'

dayjs.extend(utc)
dayjs.extend(timezone)

export async function exchangeRatesOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'newExchangeRate',
      data: {}
    }
  })

  await bot.sendMessage(userId, `¡Vamos a crear un nuevo cambio de moneda para <b>${book.title}</b>! 📚\n\nEscribe la moneda A en tres letras:`, {
    parse_mode: 'HTML'
  })
}

export async function exchangeRatesOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ msg, bot } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (!conversationData.currencyA) {
    const currency = currencyEval(text)
    if (!currency.isOk) {
      await bot.sendMessage(userId, currency.error)
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          ...conversationData,
          currencyA: currency.value
        }
      }
    })

    await bot.sendMessage(userId, `Escribe la moneda B en tres letras:`, {
      parse_mode: 'HTML'
    })
    return
  }

  if (!conversationData.currencyB) {
    const currency = currencyEval(text)
    if (!currency.isOk) {
      await bot.sendMessage(userId, currency.error)
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          ...conversationData,
          currencyB: currency.value
        }
      }
    })

    await bot.sendMessage(userId, `Escribe el valor de cambio:\n1 <b>${conversationData.currencyA}</b> = ? <b>${currency.value}</b>`, { parse_mode: 'HTML' })
    return
  }

  if (!conversationData.rateAtoB || !conversationData.rateBtoA) {
    const amount = mathEval(text)
    if (!amount.isOk) {
      await bot.sendMessage(userId, amount.error)
      return
    }

    if (amount.value < 0) {
      await bot.sendMessage(userId, 'La respuesta debe ser un número mayor a 0.')
      return
    }

    if (!conversationData.rateAtoB) {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          data: {
            ...conversationData,
            rateAtoB: amount.value
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el valor de cambio:\n1 <b>${conversationData.currencyB}</b> = ? <b>${conversationData.currencyA}</b>`, { parse_mode: 'HTML' })
      return
    }

    if (!conversationData.rateBtoA) {
      await prisma.exchangeRate.create({
        data: {
          bookId: book.id,
          from: conversationData.currencyA,
          to: conversationData.currencyB,
          amount: conversationData.rateAtoB,
          validFrom: dayjs().tz(book.owner.timezone).startOf('month').format()
        }
      })

      await prisma.exchangeRate.create({
        data: {
          bookId: book.id,
          from: conversationData.currencyB,
          to: conversationData.currencyA,
          amount: amount.value,
          validFrom: dayjs().tz(book.owner.timezone).startOf('month').format()
        }
      })

      await bot.sendMessage(userId, `🎉 ¡Cambio de moneda creado! 🎉\n\n1 <b>${conversationData.currencyA}</b> = ${conversationData.rateAtoB} <b>${conversationData.currencyB}</b>\n1 <b>${conversationData.currencyB}</b> = ${amount.value} <b>${conversationData.currencyA}</b>`, { parse_mode: 'HTML' })
      await waitingForCommandOnStart({ bot, msg })
      return
    }
  }
}