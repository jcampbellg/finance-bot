import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { TransactionWithAll } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'
import { transactionText } from './transactionViewMenuMessage'

export default async function transactionGroupNotificationMessage(params: ConversationPropsWithBookSelected, transaction: TransactionWithAll) {
  const { bot, bookSelected } = params

  const groups = await xprisma.groupChat.findMany({
    where: { books: { some: { id: bookSelected.id } } }
  })

  for (const group of groups) {
    try {
      const notInThisGroup = transaction.groupNotifications.find((not) => not.groupId === group.telegramId)

      if (notInThisGroup) {
        await bot.editMessageText(transactionText(params, transaction), {
          chat_id: Number(group.telegramId),
          message_id: notInThisGroup.messageId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Ver en mi chat', callback_data: `transaction_view_${transaction.id}` }]]
          }
        })
        continue
      }

      const notId = await bot.sendMessage(Number(group.telegramId), transactionText(params, transaction), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Ver en mi chat', callback_data: `transaction_view_${transaction.id}` }]]
        }
      })

      await xprisma.groupNotification.create({
        data: {
          groupId: Number(group.telegramId),
          messageId: notId.message_id,
          transactionId: transaction.id
        }
      })
    } catch (err) {
      console.log('Error sending message to group', err)
    }
  }
}

export async function transactionGroupNotificationDeleteMessage(params: ConversationPropsWithBookSelected, transaction: TransactionWithAll) {
  const { bot } = params

  const notifications = await xprisma.groupNotification.findMany({
    where: { transactionId: transaction.id }
  })

  for (const notification of notifications) {
    try {
      await xprisma.groupNotification.delete({
        where: { id: notification.id }
      })

      await bot.deleteMessage(Number(notification.groupId), notification.messageId)
    } catch (err) {
      console.log('Error deleting message from group', err)
    }
  }
}