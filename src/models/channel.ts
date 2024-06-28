import { Schema, model } from 'mongoose';

export interface IChannel extends Document {
   chatId: string;
   name: string;
   username: string;
}

const channelSchema = new Schema<IChannel>({
   chatId: { type: String, required: true, unique: true },
   name: { type: String, required: true },
   username: { type: String, required: true, unique: true },
});

const Channel = model<IChannel>('Channel', channelSchema);

export default Channel;