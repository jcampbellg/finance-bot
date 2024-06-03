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

const paymentMethod = {
  CASH: 'por efectivo',
  CREDITCARD: 'con tarjeta de crédito',
  DEBITCARD: 'con tarjeta de débito',
  TRANSFER: 'por transferencia'
}

export async function formatTransactionOne({ msg, bot }: Props, transaction: Transaction & { category: Category }) {
  const caption = `<i>${dayjs(transaction.date).tz(process.env.timezone).locale('es').format('dddd, MMMM D, YYYY h:mm A')}</i>\n<b>${!!transaction.fileUrl ? '📎 ' : ''}${transaction.description}</b>\n${transaction.category.emoji} ${transaction.category.description}\n${transaction.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[transaction.paymentMethod]}\n${numeral(transaction.amount).format('0,0.00')} ${transaction.currency}${transaction.notes ? `\n<blockquote>${transaction.notes}</blockquote>` : ''}\n\n/adjuntar archivo\n\n/eliminar`

  if (!!transaction.fileUrl) {
    // get buffer
    const res = await fetch(transaction.fileUrl)

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

  await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
}