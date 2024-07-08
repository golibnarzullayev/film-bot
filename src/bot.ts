import 'dotenv/config'
import { Telegraf, Context } from 'telegraf';
import mongoose from 'mongoose';
import Channel, { IChannel } from './models/channel';
import User from "./models/user";
import Film from './models/cinema';

const bot = new Telegraf(process.env.BOT_TOKEN as string);

mongoose.connect(process.env.MONGO_URI as string).then();

const checkAdmin = async (ctx: any, next: Function) => {
   try {
      if (!process.env.ADMIN_IDS?.includes(ctx.from?.id)) {
         await ctx.reply("Nomalum buyruq!")
         return
      }

      next()
   } catch (error) { }
}

const getUnsubscribedChannels = async (ctx: Context): Promise<Array<{
   channelId: string,
   name: string,
   username: string
}> | undefined> => {
   try {
      const channels = await Channel.find<IChannel>().lean().exec();
      const unsubscribedChannels = [];

      for (const channel of channels) {
         try {
            const userId = ctx.from?.id;
            if (userId) {
               const chatMember = await ctx.telegram.getChatMember(channel.chatId, userId);
               if (chatMember.status === 'left' || chatMember.status === 'kicked') {
                  unsubscribedChannels.push({
                     channelId: channel.chatId,
                     name: channel.name,
                     username: channel.username,
                  });
               }
            }
         } catch (error) { }
      }
      return unsubscribedChannels;
   } catch (error) { }
};

const generateUnsubscribedButtons = async (ctx: Context, channels: Array<{ channelId: string, name: string, username: string }>) => {
   try {
      const buttons = channels.map(channel => ({
         text: channel.name,
         url: `https://t.me/${channel.username}`,
      }));

      await ctx.reply('Iltimos, quyidagi kanallarga obuna bo\'ling:', {
         reply_markup: {
            inline_keyboard: [
               ...buttons.map(button => [button]),
               [{ text: "A'zo bo'ldim ✅", callback_data: 'check_subscription' }]
            ]
         }
      });
   } catch (error) { }
}

const checkSubscription = async (ctx: any, next: Function) => {
   try {
      const unsubscribedChannels = await getUnsubscribedChannels(ctx);
      const chatId = ctx.from?.id;

      if (chatId) {
         const user = await User.findOne({ chatId: chatId });
         if (!user) await User.create({ chatId: chatId });

         if (unsubscribedChannels && unsubscribedChannels.length > 0 && !process.env.ADMIN_IDS?.split(',').includes(String(chatId))) {
            await generateUnsubscribedButtons(ctx, unsubscribedChannels);
         } else {
            next();
         }
      }
   } catch (error) { }
};

bot.use(checkSubscription);

bot.start(async (ctx) => {
   await ctx.reply('Xush kelibsiz!');
});

bot.action('check_subscription', async (ctx) => {
   try {
      const unsubscribedChannels = await getUnsubscribedChannels(ctx);

      if (unsubscribedChannels && unsubscribedChannels.length === 0) {
         await ctx.reply('Rahmat! Endi botdan to\'liq foydalanishingiz mumkin.');
      } else if (unsubscribedChannels) {
         await generateUnsubscribedButtons(ctx, unsubscribedChannels);
      }
   } catch (error) { }
});

bot.command('add_channel', checkAdmin, async (ctx) => {
   const username = ctx.message.text.split(' ').slice(1).join(' ');

   if (!username) {
      return ctx.reply('Iltimos, kanal nomini kiriting: /add_channel <channel_username>');
   }

   try {
      const chat = await ctx.telegram.getChat(`@${username}`) as any;
      if (!chat) {
         return ctx.reply("Iltimos, kanal nomini to'g'ri kiriting");
      }

      const chatId = chat.id.toString();
      const channel = await Channel.findOne({ chatId: chatId });
      if (channel) {
         await ctx.reply("Bu kanal allaqachon qo'shilgan.");
         return;
      }
      const name = chat.title;

      await Channel.create({ name: name, chatId: chatId, username: username });

      await ctx.reply(`Kanal qo'shildi: ${name}`)
   } catch (error) {
      await ctx.reply('Kanalni qo\'shishda xatolik yuz berdi.');
   }
});

bot.command('list_channels', checkAdmin, async (ctx) => {
   try {
      const channels = await Channel.find();
      const channelList = channels.map((channel, index) => `${index + 1}. ${channel.name}`).join('\n');
      await ctx.replyWithHTML(`Qo'shilgan kanallar:\n<b>${channelList}</b>`);
   } catch (error) { }
});

bot.command('delete_channel', checkAdmin, async (ctx) => {
   const chatId = ctx.message.chat.id.toString();
   const name = ctx.message.text.split(' ').slice(1).join(' ');

   if (!name) {
      return ctx.reply('Iltimos, kanal nomini kiriting: /delete_channel <channel_name>');
   }

   try {
      await Channel.findOneAndDelete({ chatId, name });
      await ctx.reply(`Kanal o'chirildi: ${name}`);
   } catch (error) {
      await ctx.reply('Kanalni o\'chirishda xatolik yuz berdi.');
   }
});

bot.command('add_film', checkAdmin, async (ctx) => {
   const [_, url, code, ...name] = ctx.message.text.split(' ');

   if (!url || !code || !name) {
      await ctx.reply("Kino url, code yoki nomi kiritilmagan!")
      return;
   }

   if (Number.isNaN(code)) {
      await ctx.reply("Kino kodi son bo'lishi kerak")
      return;
   }

   try {
      const existsUrl = await Film.findOne({ url });
      if (existsUrl) {
         await ctx.reply("Kino allaqachon qo'shilgan!")
         return;
      }

      const existCode = await Film.findOne({ code });
      if (existCode) {
         await ctx.reply("Bu kodli kino mavjud!");
         return;
      }

      await Film.create({ url, code: Number(code), name: name.join(' ') });

      await ctx.reply(`Kanal qo'shildi: ${name.join(' ')}`);
   } catch (error) {
      await ctx.reply('Kinoni qo\'shishda xatolik yuz berdi.');
   }
});

bot.command('delete_film', checkAdmin, async (ctx) => {
   const [_, code] = ctx.message.text.split(' ');

   if (!code) return ctx.reply('Iltimos, film kodini kiriting: /delete_film 1');

   if (Number.isNaN(code)) {
      await ctx.reply("Kino kodi son bo'lishi kerak")
      return;
   }

   try {
      const film = await Film.findOne({ code: Number(code) });
      if (!film) {
         await ctx.reply("Bunday kino mavjud emas.");
         return;
      }

      await Film.deleteOne({ code });
   } catch (error) {
      await ctx.reply("Kinoni o'chirishda xatolik yuz berdi.");
   }
})

bot.command('stat', checkAdmin, async (ctx) => {
   try {
      const countUser = await User.estimatedDocumentCount();
      const message = `Jami foydalanuvchilar soni: ${countUser}`;

      await ctx.reply(message);
   } catch (error) { }
})

bot.hears(/^\d+$/, async (ctx) => {
   try {
      const code = ctx.message.text;
      const film = await Film.findOne({ code: Number(code) });

      if (!film) {
         await ctx.reply('Kino topilmadi!');
         return;
      }

      await ctx.replyWithVideo(film.url, {
         caption: film.name
      });
   } catch (error) {
      await ctx.reply('Kino topilmadi!');
   }
})

process.on('unhandledRejection', (reason, _) => {
   console.error(`Rejection: ${reason}`, { type: 'rejection' });
});
process.on('uncaughtException', error => {
   console.error(`Exception: ${error.message}`, { type: 'exception' });
});

bot.launch();
