import 'dotenv/config'
import { Telegraf, Context } from 'telegraf';
import mongoose from 'mongoose';
import Channel, { IChannel } from './models/channel';
import User from "./models/user";
import Film from './models/cinema';

const bot = new Telegraf(process.env.BOT_TOKEN as string);

mongoose.connect(process.env.MONGO_URI as string).then();

const checkAdmin = async (ctx: any, next: Function) => {
   if (!process.env.ADMIN_IDS?.includes(ctx.from.id)) {
      await ctx.reply("Nomalum buyruq!")
      return
   }

   next()
}

const getUnsubscribedChannels = async (ctx: Context): Promise<Array<{
   channelId: string,
   name: string,
   username: string
}> | undefined> => {
   const channels = await Channel.find<IChannel>().lean().exec();
   const unsubscribedChannels = [];
   const chatId = ctx.from?.id as any as string;

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
};

const generateUnsubscribedButtons = async (ctx: Context, channels: Array<{ channelId: string, name: string, username: string }>) => {
   const buttons = channels.map(channel => ({
      text: channel.name,
      url: `https://t.me/${channel.username}`,
   }));

   await ctx.reply('Iltimos, quyidagi kanallarga obuna bo\'ling:', {
      reply_markup: {
         inline_keyboard: [
            [...buttons],
            [{ text: "A'zo bo'ldim ✅", callback_data: 'check_subscription' }]
         ]
      }
   });
}

const checkSubscription = async (ctx: any, next: Function) => {
   const unsubscribedChannels = await getUnsubscribedChannels(ctx);
   const chatId = ctx.from.id;

   const user = await User.findOne({ chatId: chatId });
   if (!user) await User.create({ chatId: chatId });

   if (unsubscribedChannels && unsubscribedChannels.length > 0 && !process.env.ADMIN_IDS?.split(',').includes(String(chatId))) {
      await generateUnsubscribedButtons(ctx, unsubscribedChannels);
   } else {
      next();
   }
};

bot.use(checkSubscription);

bot.start(async (ctx) => {
   await ctx.reply('Xush kelibsiz!');
});

bot.action('check_subscription', async (ctx) => {
   const unsubscribedChannels = await getUnsubscribedChannels(ctx);

   if (unsubscribedChannels && unsubscribedChannels.length === 0) {
      await ctx.reply('Rahmat! Endi botdan to\'liq foydalanishingiz mumkin.');
   } else if (unsubscribedChannels) {
      await generateUnsubscribedButtons(ctx, unsubscribedChannels);
   }
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
   const channels = await Channel.find();
   const channelList = channels.map((channel, index) => `${index + 1}. ${channel.name}`).join('\n');
   await ctx.replyWithHTML(`Qo'shilgan kanallar:\n<b>${channelList}</b>`);
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
      await ctx.reply("Koni kodi son bo'lishi kerak")
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

bot.hears(/^\d+$/, async (ctx) => {
   const code = ctx.message.text;
   const film = await Film.findOne({ code: Number(code) });

   if (!film) {
      await ctx.reply('Kino topilmadi!');
      return;
   }

   await ctx.replyWithVideo(film.url, {
      caption: film.name
   });
})

bot.launch().then();