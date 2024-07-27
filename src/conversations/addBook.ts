import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import { endButtons } from '@conversations/mainMenu'

export async function onAddBookBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation, firstName } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  await xprisma.conversation.waiting(conversation.id, null)

  await bot.sendMessage(userId, `¡Hola ${firstName}!\n\nAquí está el ID de usuario que necesitas compartir:\n<code>${user.id}</code>.\n\nPara compartir el libro dile a tu amigo que sigue estos pasos:\n1. Ve a "Ver y Seleccionar Libro".\n2. Selecciona el libro.\n3. Ve a "Compartir y Permisos".\n4. Pega el ID de usuario.`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })
}