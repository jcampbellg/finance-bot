import { Category, Transaction } from '@prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import TelegramBot from 'node-telegram-bot-api'
import numeral from 'numeral'

if (process.env.timezone === undefined) {
  throw new Error('timezone is not defined')
}

dayjs.extend(utc)
dayjs.extend(timezone)

type Props = {
  msg: TelegramBot.Message
  bot: TelegramBot
}

type Change = {
  dollarToHNL: number
  hnlToDollar: number
}

const paymentMethod = {
  CASH: 'por efectivo',
  CREDITCARD: 'con tarjeta de crédito',
  DEBITCARD: 'con tarjeta de débito',
  TRANSFER: 'por transferencia'
}

type TransactionWithCategory = Transaction & { category: Category }
type CategoryWithTransactions = Category & { transactions: Transaction[] }

export async function formatTransactionOne({ msg, bot }: Props, transaction: TransactionWithCategory) {
  const caption = `<i>${dayjs(transaction.date).tz(process.env.timezone).locale('es').format('dddd, MMMM D, YYYY h:mm A')}</i>\n<b>${!!transaction.fileId ? '📎 ' : ''}${transaction.description}</b>\n${transaction.category.emoji} ${transaction.category.description}\n${transaction.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[transaction.paymentMethod]}\n${numeral(transaction.amount).format('0,0.00')} ${transaction.currency}${transaction.notes ? `\n<blockquote>${transaction.notes}</blockquote>` : ''}\n\n/renombrar\n\n/editar monto\n\n/notas\n\n/adjuntar archivo\n\n/eliminar`

  if (!!transaction.fileId) {
    try {
      const fileUrl = !!transaction.fileId ? await bot.getFileLink(transaction.fileId) : null

      if (!!fileUrl) {
        // get buffer
        const res = await fetch(fileUrl)

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          if (transaction.fileType === 'PHOTO') {
            await bot.sendPhoto(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          } else {
            await bot.sendDocument(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          }
          return
        }
        await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
      }
    } catch (error) {
      console.error(error)
      await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
    }
  }

  await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
}

export async function formatCategoryOne({ msg, bot, dollarToHNL, hnlToDollar }: Props & Change, category: CategoryWithTransactions) {
  const spendHNL = category.transactions.reduce((acc, t) => {
    if (t.currency === 'HNL') {
      if (t.type === 'INCOME') {
        return acc - t.amount
      }
      return acc + t.amount
    }
    return acc
  }, 0)

  const spendUSD = category.transactions.reduce((acc, t) => {
    if (t.currency === 'USD') {
      if (t.type === 'INCOME') {
        return acc - t.amount
      }
      return acc + t.amount
    }
    return acc
  }, 0)

  const spendTotal = category.transactions.reduce((acc, t) => {
    if (category.currency === 'HNL') {
      if (t.type === 'INCOME') {
        if (t.currency === 'USD') return acc - (t.amount * dollarToHNL)
        return acc - t.amount
      }
      if (t.currency === 'USD') return acc + (t.amount * dollarToHNL)
      return acc + t.amount
    } else {
      if (t.type === 'INCOME') {
        if (t.currency === 'HNL') return acc - (t.amount * hnlToDollar)
        return acc - t.amount
      }
      if (t.currency === 'HNL') return acc + (t.amount * hnlToDollar)
      return acc + t.amount
    }
  }, 0)

  const spendText = `Gasto:\n${numeral(spendHNL).format('0,0.00')} HNL\n${numeral(spendUSD).format('0,0.00')} USD\n`
  const limitText = `Límite:\n${numeral(spendTotal).format('0,0.00')} / ${numeral(category.limit).format('0,0.00')} ${category.currency}${category.isFixed ? '\n<i>Gasto Fijo</i>' : ''}`
  const notesText = category.notes ? `\n\n<blockquote>${category.notes}</blockquote>` : ''

  const caption = `<b>${!!category.fileId ? '📎 ' : ''}${category.emoji} ${category.description}</b>\n\n${spendText}\n${limitText}${notesText}\n\n¿Qué quieres hacer?\n\n/renombrar\n\n/editar limite\n\n${category.isFixed ? '/quitar de gasto fijos' : '/poner en gastos fijos'}\n\n/notas\n\n/adjuntar archivo\n\n/eliminar`

  if (!!category.fileId) {
    try {
      const fileUrl = !!category.fileId ? await bot.getFileLink(category.fileId) : null

      if (!!fileUrl) {
        // get buffer
        const res = await fetch(fileUrl)

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          if (category.fileType === 'PHOTO') {
            await bot.sendPhoto(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          } else {
            await bot.sendDocument(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          }
          return
        }
        await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
      }
    } catch (error) {
      console.error(error)
      await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
    }
  }

  await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
}