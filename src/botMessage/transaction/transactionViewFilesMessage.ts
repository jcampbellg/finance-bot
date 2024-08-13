import noTransactionError from '@botMessage/errors/noTransactionError'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { TransactionWithAll } from '@customTypes/prismaTypes'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function transactionViewFilesMessage(params: ConversationPropsWithBookSelected, transactionIdImport?: string) {
  const { query, user } = params

  await xprisma.conversation.waiting(params.conversation.id)

  const transactionId = transactionIdImport || query?.data.replace('transaction_files_', '')

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  const transaction = await xprisma.transaction.findUnique(user, transactionId)

  if (!transaction) {
    await noTransactionError(params)
    return
  }

  await botTransaction(params, transaction)
}

export async function botTransaction(params: ConversationPropsWithBookSelected, t: TransactionWithAll) {
  const { bot, chatId } = params

  const files = t.files

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    const keyboard = [[{ text: '❌ Borrar', callback_data: `file_delete_${file.id}` }]]
    const items = file.items.map((it, i) => `${i + 1}. ${it.description}`).join('\n')
    const caption = `<b>${t.description}</b>\n\n${items}`

    if (file.fileType === 'PHOTO') {
      await bot.sendPhoto(chatId, file.fileId, {
        parse_mode: 'HTML',
        caption,
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
    } else {
      await bot.sendDocument(chatId, file.fileId, {
        parse_mode: 'HTML',
        caption,
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
    }
  }
}