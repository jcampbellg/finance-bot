import { BookWithRoleAndOwner } from '@customTypes/prismaTypes'
import TelegramBot from 'node-telegram-bot-api'
import { endButton } from './newConversation'

export async function bookFormat(bot: TelegramBot, book: BookWithRoleAndOwner): Promise<[string, TelegramBot.SendMessageOptions]> {
  const { title, timezone, role } = book
  const permision = role.permision === 'OWNER' ? 'Dueño' : role.permision === 'ADMIN' ? 'Administrador' : 'Editor'

  const ownerName = await bot.getChat(book.owner.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')

  const owner = role.permision === 'OWNER' ? 'Tú' : ownerName

  const text = `<b>${title}</b>\n\nDueño: ${owner}\nZona horaria: ${timezone}\nPermisos: ${permision}`

  return [text, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [{ text: '✔ Seleccionar', callback_data: 'select_book' }, { text: '↪ Compartir', callback_data: 'share_book' }],
        [{ text: '📝 Renombrar', callback_data: 'edit_book' }, { text: '🗑️ Eliminar', callback_data: 'delete_book' }],
        ...endButton()
      ]
    }
  }]
}