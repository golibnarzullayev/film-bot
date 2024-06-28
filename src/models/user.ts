import { Schema, model } from 'mongoose';

export interface IUser extends Document {
    chatId: string;
}

const userSchema = new Schema<IUser>({
    chatId: { type: String, required: true, unique: true },
});

const User = model<IUser>('User', userSchema);

export default User;